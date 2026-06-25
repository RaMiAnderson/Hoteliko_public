import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import { toast } from "react-hot-toast";
import './dashContent.css';
import CardMoney from "../../../components/CardMoney/CardMoney";
import LineChart from "../../../components/lineChart/LineChartStat.jsx";
import TableList from "../../../components/TableList/TableList1.jsx";
import InputSearch from "../../../components/InputSearch/InputSearch.jsx"
import BasicButton from "../../../components/BasicButton/BasicButtons.jsx"
import Loading from "../../../components/Loading/Loading.jsx";
import { useTheme } from "../../../context/themeContext";
import { formatNumberWithSpace } from "../../../services/formatNumber.js";
import useRealtimeEvents from "../../../services/useRealtimeEvents.js";

const FALLBACK_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

const dashBoardContent = () => {
  const API_URL = import.meta.env.VITE_API_URL;
  const { theme } = useTheme();
  const [searchParams] = useSearchParams();
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  const [isLoading, setIsLoading] = useState(true);
  const [isTabLoading, setIsTabLoading] = useState(false);
  const [searchArticleValue, setSearchArticleValue] = useState("");
  const [designationFilter, setDesignationFilter] = useState("");
  const firstLoadRef = useRef(false);
  const requestControllerRef = useRef(null);
  const lastRealtimeSyncRef = useRef(0);

  const [dashboardData, setDashboardData] = useState({
    period: { startDate: "", endDate: "" },
    kpis: {
      vente: 0,
      revient: 0,
      depense: 0,
      encaisses: 0,
      aEncaisser: 0,
      benefices: 0,
      encaissement: {
        espece: 0,
        mobile_money: 0,
        autre: 0
      },
      recette: {
        vente: 0,
        revientEncaisse: 0,
        beneficeEncaisse: 0
      }
    },
    chart: [],
    articles: []
  });

  const fetchDashboardData = async (designationValue = designationFilter, withPageLoader = false) => {
    if (!startDate || !endDate) return;

    const cleanedDesignation = designationValue.trim();
    let controller = null;

    try {
      if (requestControllerRef.current) {
        requestControllerRef.current.abort();
      }
      controller = new AbortController();
      requestControllerRef.current = controller;

      if (withPageLoader) setIsLoading(true);
      else setIsTabLoading(true);

      const params = { startDate, endDate };
      if (cleanedDesignation !== "") params.designation = cleanedDesignation;

      const response = await axios.get(`${API_URL}/api/dashboard/overview`, { params, signal: controller.signal });
      if (response.status === 200) {
        setDashboardData(response.data);
      } else {
        toast.error("Erreur de chargement du dashboard");
      }
    } catch (err) {
      if (err?.name === "CanceledError" || err?.code === "ERR_CANCELED") {
        return;
      }
      toast.error("Erreur de chargement du dashboard");
      console.log(err);
    } finally {
      firstLoadRef.current = true;
      if (requestControllerRef.current === controller) {
        requestControllerRef.current = null;
        setIsLoading(false);
        setIsTabLoading(false);
      }
    }
  };

  useRealtimeEvents((event) => {
    if (!event || !["stock-updated", "articles-updated"].includes(event.type)) return;
    if (!startDate || !endDate) return;

    const now = Date.now();
    if (now - lastRealtimeSyncRef.current < 1500) return;
    lastRealtimeSyncRef.current = now;

    fetchDashboardData(designationFilter, false);
  });

  useEffect(() => {
    if (!startDate || !endDate) return;

    fetchDashboardData(designationFilter, !firstLoadRef.current);

    return () => {
      if (requestControllerRef.current) {
        requestControllerRef.current.abort();
        requestControllerRef.current = null;
      }
    };
  }, [startDate, endDate, designationFilter]);

  useEffect(() => {
    if (!startDate || !endDate) return;

    const intervalId = setInterval(() => {
      fetchDashboardData(designationFilter, false);
    }, FALLBACK_REFRESH_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [startDate, endDate, designationFilter]);

  const handleRefresh = async () => {
    setSearchArticleValue("");

    if (designationFilter !== "") {
      setDesignationFilter("");
      return;
    }

    await fetchDashboardData("", false);
  };

  const handleSearch = async (designationValue = searchArticleValue) => {
    const cleanedDesignation = String(designationValue ?? "").trim();
    setSearchArticleValue(cleanedDesignation);

    if (cleanedDesignation === designationFilter) {
      await fetchDashboardData(cleanedDesignation, false);
      return;
    }

    setDesignationFilter(cleanedDesignation);
  };

  const handleSearchKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSearch(event.target.value);
    }
  };

  const optionsInputSearch = useMemo(() => {
    return dashboardData.articles.map((article) => article.designation);
  }, [dashboardData.articles]);

  if (isLoading) {
    return (
      <div style={{
        width: "100%",
        height: "91vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: theme === "light" ? "var(--whiteBe)" : "var(--darkBodyColor)"
      }}>
        <Loading />
      </div>
    );
  }

  return (
    <>
      {/* leftPart */}
      <div className="leftPart">
        {/* topPart */}
        <div className="topPart">
         <div className="partOne">
          <CardMoney color="var(--cardMVente)" label="Vente" montant={formatNumberWithSpace(dashboardData.kpis.vente)} />
          <CardMoney color="var(--cardMRevient)" label="Revient" montant={formatNumberWithSpace(dashboardData.kpis.revient)} />
          <CardMoney color="var(--cardMDepense)" label="Dépense" montant={formatNumberWithSpace(dashboardData.kpis.depense)} />
         </div>
         <div className="partOne">
          <CardMoney color="var(--cardMVente)" label="Encaissés" montant={formatNumberWithSpace(dashboardData.kpis.encaisses)} />
          <CardMoney color="var(--cardMVente)" label="À Encaisser" montant={formatNumberWithSpace(dashboardData.kpis.aEncaisser)} />
          <CardMoney color="var(--cardMEncaisse)" label="Bénéfices" montant={formatNumberWithSpace(dashboardData.kpis.benefices)} />
         </div>
         {/* Details d'encaissmnt */}
         <div>
          <h3 className="titlePart">Détails des encaissés</h3>
         </div> 
         <div className="partOne">
          <CardMoney color="var(--whiteTransp)" label="Espece" montant={formatNumberWithSpace(dashboardData.kpis.encaissement.espece)} />
          <CardMoney color="var(--whiteTransp)" label="Mobile" montant={formatNumberWithSpace(dashboardData.kpis.encaissement.mobile_money)} />
          <CardMoney color="var(--whiteTransp)" label="Autre" montant={formatNumberWithSpace(dashboardData.kpis.encaissement.autre)} />
         </div>
         <div>
          <h3 className="titlePart">Recette</h3>
         </div>
         <div className="partOne">
          <CardMoney color="var(--cardMVente)" label="Vente encaissé" montant={formatNumberWithSpace(dashboardData.kpis.recette.vente)} />
          <CardMoney color="var(--cardMRevient)" label="Revient encaissé" montant={formatNumberWithSpace(dashboardData.kpis.recette.revientEncaisse)} />
          <CardMoney color="var(--cardMEncaisse)" label="Bénéfice encaissé" montant={formatNumberWithSpace(dashboardData.kpis.recette.beneficeEncaisse)} />
         </div>
        </div>
        {/* bottomPart */}
        <div className="bottomPart">
          <LineChart data={dashboardData.chart} />
        </div>
      </div> 
      {/* rightPart */}
      <div className="rightPart">
        <div className="findSection">
          <h4>Liste des Produits</h4>
          <section>
            <BasicButton
              variant={"outlined"}
              color={"var(--ThemClaire)"}
              colorH={"var(--white)"}
              bgColor={"transparent"} 
              bgColorH={"var(--ThemClaire)"} 
              bgColorA={"var(--ThemClaire)"} 
              brdrColor={"var(--ThemClaire)"}
              brdrColorH={"var(--ThemClaire)"}
              textBtn={isTabLoading ? "Actualisation..." : "Actualiser"} 
              width={130} 
              padding={"7.7px 0px 9px 0px"} 
              onClick={handleRefresh}
            />
            <div style={{marginRight : "10px", marginLeft: "10px"}}>
              <InputSearch
                value={searchArticleValue}
                onChangeValue={setSearchArticleValue}
                options={optionsInputSearch}
                onKeyDown={handleSearchKeyDown}
              />
            </div>
            <BasicButton
              variant={"contained"}
              color={"var(--white)"} 
              bgColor={"#f87269"} 
              bgColorH={"#eb6258"} 
              bgColorA={"#E42417"} 
              brdrColor={"#f87269"}
              brdrColorH={"#eb6258"}
              textBtn={"Rechercher"} 
              width={100} 
              padding={"7.7px 0px 9px 0px"} 
              onClick={handleSearch}
            />
          </section>
        </div>
        <div className="tableAff" style={{overflow : 'hidden'}}>
          <TableList rowsData={dashboardData.articles} />
        </div>
      </div>
    </>
  );
}; 

export default dashBoardContent;
