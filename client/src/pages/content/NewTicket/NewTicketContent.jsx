import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import "./NewTicketContent.css";
import { useTheme } from '../../../context/themeContext';
import { formatNumber, formatNumberWithSpace } from '../../../services/formatNumber.js';
import useRealtimeEvents from '../../../services/useRealtimeEvents.js';

import TableList from "../../../components/TableList/TableListReactif_delBtn.jsx";
import TableListCmnd from "../../../components/TableList/TableListInComnd.jsx";
import InputSearch from "../../../components/InputSearch/InputSearch.jsx";
import BasicButton from "../../../components/BasicButton/BasicButtons.jsx";
import MoreBtn from "../../../components/SettingTopBar/More.jsx"
import axios from 'axios';
import CloseIco from "@mui/icons-material/CloseRounded"
import TextField from "../../../components/Textfield/TextField.jsx";
import toast from 'react-hot-toast';
import Loading from "../../../components/Loading/Loading.jsx"

const FALLBACK_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export default function NewTicketContent() {
	const { theme } = useTheme();
	const API_URL = import.meta.env.VITE_API_URL;
	const navigate = useNavigate();

	function createData(ID, designation, type, qt, mesure, achat, vente, seuil) {
		return { ID, designation, type, qt, mesure, achat, vente, seuil };
	}

	function createRow(row, index) {
		return ({
			id: row.ID || index,
			designation: row.designation,
			type: row.type,
			qt: row.qt,
			mesure: row.mesure,
			achat: row.achat,
			vente: row.vente
		})
	}

	const [allArticles, setAllArticles] = useState([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isTabLoading, setIsTabLoading] = useState(true);
	const [TabDataBody, setTabDataBody] = useState([]);
	const [search_Article_Value, setSearchArticleValue] = useState("");

	const [allClients, setAllClients] = useState([]);
	const [isLoadingClient, setIsLoadingClient] = useState(true);
	const [TabDataClient, setTabDataClient] = useState([]);
	const [search_Client_Value, setSearchClientValue] = useState("");
	const lastRealtimeSyncRef = useRef(0);


	const reinit_AllArticles = useCallback(async ({ resetSearch = true } = {}) => {
		try {
			setIsTabLoading(true);
			const resInit = await axios.get(`${API_URL}/api/articles/all`);
			if (resInit.status == 200)
				setAllArticles(resInit.data)
			else toast.error("Erreur d'initialisation des articles");
		} catch {
			toast.error("Erreur d'initialisation des articles");
		} finally {
			setIsTabLoading(false);
			if (resetSearch) setSearchArticleValue("");
		}
	}, [API_URL]);

	useEffect(() => {
		const init = async () => {
			setIsLoading(true);
			await reinit_AllArticles({ resetSearch: false });
			setIsLoading(false);
		};

		init();
	}, [reinit_AllArticles]);

	useRealtimeEvents(useCallback((event) => {
		if (!event || !["stock-updated", "articles-updated"].includes(event.type)) return;

		const now = Date.now();
		if (now - lastRealtimeSyncRef.current < 1500) return;
		lastRealtimeSyncRef.current = now;

		reinit_AllArticles({ resetSearch: false });
	}, [reinit_AllArticles]));

	useEffect(() => {
		const intervalId = setInterval(() => {
			reinit_AllArticles({ resetSearch: false });
		}, FALLBACK_REFRESH_INTERVAL_MS);

		return () => clearInterval(intervalId);
	}, [reinit_AllArticles]);

	useEffect(() => {
		setIsTabLoading(true);
		setTabDataBody(
			allArticles.map((article) =>
				createData(
					article.id,
					article.designation,
					article.type,
					article.qt,
					article.mesure,
					formatNumber(article.achat),
					formatNumber(article.vente),
					article.seuil
				)
			)
		);
		setIsTabLoading(false)
	}, [allArticles]);

	const [TabDataCond, setTabDataCond] = useState([]);
	const [isPopupValideCmnd, setIsPopupValideCmnd] = useState(false);

	const if_oneRowclicked = (id) => {
		const article = TabDataBody.find(item => item.ID === id);
		if (article) {
			const exists = TabDataCond.some(item => item.ID === id);
			if (!exists) {
				setTabDataCond(prev => [...prev, { ...article, qt: 1 }]);
			}
		}
	};

	const OnDeleteBTNClicked = (id) => {
		setTabDataCond(prev => prev.filter(item => item.ID !== id));
	};

	const handleQtyChange = (id, value) => {
		if (!/^\d+$/.test(value)) {
			setTabDataCond(prev =>
				prev.map(item =>
					item.ID === id ? { ...item, qt: 1 } : item
				)
			);
			setIsAnErrorInput(true);
			toast.error("Verifiez les champs", 200);
			return;
		}

		const qty = Number(value);

		if (qty <= 0) {
			setTabDataCond(prev =>
				prev.map(item =>
					item.ID === id ? { ...item, qt: 1 } : item
				)
			);
			setIsAnErrorInput(true);
			toast.error("Verifiez les champs", 200);
			return;
		}

		setTabDataCond(prev =>
			prev.map(item =>
				item.ID === id ? { ...item, qt: qty } : item
			)
		);
		setIsPopupValideCmnd(false);
		setIsAnErrorInput(false);
	};



	const handleReset = () => {
		setTabDataCond([]);
		setTypePaiement(1);
		setNumTable("");
		setNomServiPar("")
		setIsAnErrorInput(false)
		setmontantRecuCmnd("")
	};

	const handleValidateBefore = async () => {
		if (TabDataCond.length == 0) {
			toast.error("Votre commande est vide");
			return;
		}
		setIsLoadingClient(true);
		try {
			const resClientGet = await axios.get(`${API_URL}/api/clients/all`);
			if (resClientGet.status == 200)
				setAllClients(resClientGet.data);
			else
				toast.error("Une erreur s'est produite au client")
		} catch (err) {
			toast.error("Erreur s'est produite");
			console.log(err);
		} finally {
			setIsPopupValideCmnd(true);
			setSearchClientValue("");
			setIsLoadingClient(false);
		}
	}

	const [typePaiement, setTypePaiement] = useState(1);
	const [numTable, setNumTable] = useState("")
	const [nomServiPar, setNomServiPar] = useState("");
	const [totalCommande, setTotalCommande] = useState(0);
	const [montantRecuCmnd, setmontantRecuCmnd] = useState("");
	const [montantARendre, setMontantARendre] = useState(0);
	const [isAnErrorInput, setIsAnErrorInput] = useState(false)

	const handleValidateAuComptant = async (montantRecu, typePaie) => {
		if (search_Client_Value == "")
		{
			toast.error("Veuillez choisir le client");
			return ;
		}
		const clientInTick = allClients.find(
			c => c.nom === search_Client_Value
		);
		if (!clientInTick) {
			toast.error("Client introuvable");
			return;
		}
		if (numTable == "")
		{
			toast.error("Table vide");
			return ;
		}
		if (nomServiPar == "")
		{
			toast.error("Nom serveur(se) vide");
			return ;
		}
		if (typePaiement == 1 && (montantARendre < 0 || montantRecu < totalCommande))
		{
			toast.error("Solde inferieur");
			return ;
		}
		const data = {
		  client_id: clientInTick.id,
		  table_num: numTable,
		  servi_par : nomServiPar,
		  type_paiement : typePaie,
		  mode_paiement: "espece",
		  montant_paye : montantRecu,
		  total_ticket : totalCommande,
		  montant_a_rendre : montantARendre,
		  items: TabDataCond
		}
		try{
			const resCreateTick = await axios.post(`${API_URL}/api/tickets/create`, data);
			if (resCreateTick.status == 201)
			{	
				setTabDataCond([]);
				setmontantRecuCmnd("");
				setTypePaiement(1);
				setNumTable("");
				setNomServiPar("")
				setIsAnErrorInput(false)
				setIsPopupValideCmnd(false);
				reinit_AllArticles()
			}
			else
			{
				setTabDataCond([]);
				setmontantRecuCmnd("");
				setTypePaiement(1);
				setNumTable("");
				setNomServiPar("")
				setIsAnErrorInput(false)
				setIsPopupValideCmnd(false);
			}
		} catch (err)
		{
			toast.error("Une erreur s'est produite");
			console.log(err);
		}
	}
	
	const totalCalcule = useMemo(() => {
		return TabDataCond.reduce((total, item) => {
			const prix = Number(
				String(item.vente).replace(/\s/g, "")
			) || 0;

			return total + prix * item.qt;
		}, 0);
	}, [TabDataCond]);

	useEffect(() => {
		setTotalCommande(totalCalcule);
	}, [totalCalcule]);

	useEffect(() => {
		if (!/^\d*\.?\d*$/.test(montantRecuCmnd)) {
			toast.error("Montant reçu invalide !");
			setmontantRecuCmnd("");
			setMontantARendre(0);
			return;
		}

		const recu = Number(montantRecuCmnd) || 0;

		if (recu < 0) {
			toast.error("Le montant reçu ne peut pas être négatif !");
			setmontantRecuCmnd("");
			setMontantARendre(0);
			return;
		}

		setMontantARendre(recu - totalCommande);
	}, [montantRecuCmnd, totalCommande]);




	const handleValidate = () => {
		const qts = TabDataCond.map(item => `${item.designation}: ${item.qt}`);

	};

	const optionsInputSearch = useMemo(() => {
		return TabDataBody.map(article => article.designation);
	}, [TabDataBody]);

	const optionsInputSearchClient = useMemo(() => {
		return allClients.map(client => client.nom);
	}, [allClients]);

	const find_searchArticleValue = async (designation = search_Article_Value) => {
		const cleanedDesignation = String(designation ?? "").trim();

		if (cleanedDesignation === "") {
			await reinit_AllArticles({ resetSearch: false });
			return;
		}

		try {
			setIsTabLoading(true);
			const resSearch = await axios.get(`${API_URL}/api/articles/search?designation=${encodeURIComponent(cleanedDesignation)}`)
			if (resSearch.status == 200)
				setAllArticles(resSearch.data)
			else toast.error("Search Error");
		} catch (err) {
			toast.error("Search Error");
			console.log(err);
		} finally {
			setIsTabLoading(false);
		}
	}

	const handleArticleSearchKeyDown = (event) => {
		if (event.key === "Enter") {
			event.preventDefault();
			find_searchArticleValue(event.target.value);
		}
	};

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
				< Loading />
			</div>
		);
	}

	if (!isLoading)
		return (
			<>
				{isPopupValideCmnd && !isLoadingClient && !isAnErrorInput && (
					<div className='popup-overlay' style={{ boxShadow: theme === "light" ? "0 10px 30px var(--noirbe)" : "0 10px 30px var(--whiteBe)" }}>
						<div className="popup-content" style={{ backgroundColor: theme == "light" ? "var(--whiteBeMax)" : "var(--noirbe)" }}>
							{/* header */}
							<div style={{ width: "100%", justifyContent: "space-between", alignItems: "center", display: "flex" }}>
								<h3>Valider votre commande</h3>
								<BasicButton
									variant={"contained"}
									color={"var(--white)"}
									bgColor={"#f87269"}
									bgColorH={"#eb6258"}
									bgColorA={"#E42417"}
									brdrColor={"#f87269"}
									brdrColorH={"#eb6258"}
									textBtn={<CloseIco sx={{ width: 27, height: 27 }} />}
									width={27}
									padding={"7.7px 0px 9px 0px"}
									onClick={() => setIsPopupValideCmnd(false)}
								/>
							</div>
							<div >
								<div style={{ width: "100%", display: "flex", justifyContent: "space-between", marginTop: "30px" }}>
									<div style={{ marginTop: "10px" }}>
										<InputSearch value={search_Client_Value} onChangeValue={setSearchClientValue} options={optionsInputSearchClient} label={"Client"} />
									</div>
									<div style={{ marginTop: "10px", width: "35%" }}>
										<TextField Width={"100%"} Placeholder={"Table"} value={numTable} onChangeValue={setNumTable} />
									</div>
									<div style={{ marginTop: "10px", width: "35%" }}>
										<TextField Width={"100%"} Placeholder={"Serveur(se)"} value={nomServiPar} onChangeValue={setNomServiPar} />
									</div>
								</div>
								<h3 style={{ marginTop: "50px" }}>Montant de la commande : {formatNumberWithSpace(totalCommande)} Ar</h3>
								<h4 style={{ marginTop: "30px" }}>Type du paiement</h4>
								<div style={{ width: "100%", display: "flex", justifyContent: "center", marginTop: "20px" }}>
									<div style={{ width: "60%", display: "flex", justifyContent: "space-evenly" }}>
										<BasicButton
											variant={"outlined"}
											color={"var(--ThemClaire)"}
											colorH={"var(--white)"}
											bgColor={"transparent"}
											bgColorH={"var(--ThemClaire)"}
											bgColorA={"var(--ThemClaire)"}
											brdrColor={"var(--ThemClaire)"}
											brdrColorH={"var(--ThemClaire)"}
											textBtn={"Au comptant"}
											width={120}
											padding={"7.7px 0px 9px 0px"}
											onClick={() => setTypePaiement(1)}
										/>

										<BasicButton
											variant={"outlined"}
											color={"var(--ThemClaire)"}
											colorH={"var(--white)"}
											bgColor={"transparent"}
											bgColorH={"var(--ThemClaire)"}
											bgColorA={"var(--ThemClaire)"}
											brdrColor={"var(--ThemClaire)"}
											brdrColorH={"var(--ThemClaire)"}
											textBtn={"En attente"}
											width={100}
											padding={"7.7px 0px 9px 0px"}
											onClick={() => setTypePaiement(2)}
										/>

									</div>
								</div>
								<div style={{ width: "100%", display: "flex", justifyContent: "center", marginTop: "40px" }}>
									{typePaiement == 1 && (
										<div style={{ width: "100%" }}>
											{/* headers */}
											<div style={{ width: "100%", display: "flex", justifyContent: "center" }} >
												<h4>Au Comptant</h4>
											</div>
											{/* body */}
											<div style={{ width: "100%", display: "flex", justifyContent: "space-between", marginTop: "40px", alignItems: "center" }} >
												<div style={{ marginTop: "10px", width: "45%" }}>
													<TextField Width={"100%"} Placeholder={"Montant reçu"} value={montantRecuCmnd} onChangeValue={setmontantRecuCmnd} />
												</div>
												<div style={{ marginTop: "10px", width: "45%" }}>
													<h4>Rendu : {formatNumberWithSpace(montantARendre)} Ar</h4>
												</div>
											</div>
											<div style={{ marginTop: "50px" }}>
												<BasicButton
													variant={"contained"}
													color={"var(--white)"}
													bgColor={"#f87269"}
													bgColorH={"#eb6258"}
													bgColorA={"#E42417"}
													brdrColor={"#f87269"}
													brdrColorH={"#eb6258"}
													textBtn={"Valider"}
													width={"100%"}
													padding={"7.7px 0px 9px 0px"}
													onClick={() => handleValidateAuComptant(Number(montantRecuCmnd), "comptant")}
												/>
											</div>
										</div>
									)}
									{typePaiement == 2 && (
										<div style={{ width: "100%" }}>
											{/* headers */}
											<div style={{ width: "100%", display: "flex", justifyContent: "center" }} >
												<h4>En attente</h4>
											</div>
											<div style={{ marginTop: "50px" }}>
												<BasicButton
													variant={"contained"}
													color={"var(--white)"}
													bgColor={"#f87269"}
													bgColorH={"#eb6258"}
													bgColorA={"#E42417"}
													brdrColor={"#f87269"}
													brdrColorH={"#eb6258"}
													textBtn={"Valider"}
													width={"100%"}
													padding={"7.7px 0px 9px 0px"}
													onClick={() => handleValidateAuComptant(0, "attente")}
												/>
											</div>
										</div>
									)}
								</div>
							</div>
						</div>
					</div>
				)}
				{/* leftPart */}
				<div className="leftPart">
					<div className="articlesModify" style={{ paddingTop: "15px" }}>
						<div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
							<h3>Dans la Commande</h3>
							<div style={{ display: "flex" }}>
								<div style={{ marginRight: "10px" }}>
									<BasicButton
										variant={"outlined"}
										color={"var(--ThemClaire)"}
										colorH={"var(--white)"}
										bgColor={"transparent"}
										bgColorH={"var(--ThemClaire)"}
										bgColorA={"var(--ThemClaire)"}
										brdrColor={"var(--ThemClaire)"}
										brdrColorH={"var(--ThemClaire)"}
										textBtn={"Liste en attente"}
										width={125}
										padding={"7.7px 0px 9px 0px"}
										onClick={()=> navigate("/admin/ventes")}
									/>
								</div>
								<div style={{ marginRight: "10px" }}>
									<BasicButton
										variant={"outlined"}
										color={"var(--ThemClaire)"}
										colorH={"var(--white)"}
										bgColor={"transparent"}
										bgColorH={"var(--ThemClaire)"}
										bgColorA={"var(--ThemClaire)"}
										brdrColor={"var(--ThemClaire)"}
										brdrColorH={"var(--ThemClaire)"}
										textBtn={"Réinitialiser"}
										width={100}
										padding={"7.7px 0px 9px 0px"}
										onClick={handleReset}
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
									textBtn={"Valider"}
									width={100}
									padding={"7.7px 0px 9px 0px"}
									onClick={handleValidateBefore}
								/>
							</div>
						</div>
						<div className='currentOrderTotal' style={{ marginTop: "16px" }}>
							<h4>Montant actuel de la commande : {formatNumberWithSpace(totalCommande)} Ar</h4>
						</div>
						<div className='tableAff' style={{ marginTop: "31px", overflow: "hidden" }}>
							<TableListCmnd
								TabLisHead={['Designation', 'Qt', 'Mesure', 'Prix Unitaire', 'Action']}
								TabListBody={TabDataCond}
								Numbers={6}
								onDeleteClick={OnDeleteBTNClicked}
								onQtyChange={handleQtyChange}
							/>
						</div>
					</div>
				</div>

				{/* rightPart */}
				<div className="rightPart">
					<div className="findSection">
						<h3>Liste des Articles</h3>
						<section style={{ display: "flex", alignItems: "center", gap: "10px" }}>
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
								onClick={() => {
									reinit_AllArticles();
									setSearchArticleValue("");
								}}
							/>
							<InputSearch value={search_Article_Value} onChangeValue={setSearchArticleValue} options={optionsInputSearch} onKeyDown={handleArticleSearchKeyDown} />
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
								onClick={find_searchArticleValue}
							/>
							< MoreBtn />

						</section>
					</div>

					<div className="tableAff" style={{ overflow: 'hidden', marginTop: "15px", width: "45.5vw" }}>
						<TableList
							TabLisHead={['Designation', 'Type', 'Qt', 'Mesure', 'Achat', 'Vente']}
							onRowClick={if_oneRowclicked}
							TabListBody={TabDataBody}
							createRow={createRow}
							isLoading={isTabLoading}
						/>
					</div>
				</div>
			</>
		);
}
