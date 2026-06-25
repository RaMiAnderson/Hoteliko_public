import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import "./articlesContent.css";

import { useTheme } from '../../../context/themeContext';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { formatNumber } from "../../../services/formatNumber.js"
import useRealtimeEvents from '../../../services/useRealtimeEvents.js';

import TableList from "../../../components/TableList/TableListReactif_delBtn.jsx";
import InputSearch from "../../../components/InputSearch/InputSearch.jsx";
import BasicButton from "../../../components/BasicButton/BasicButtons.jsx";
import TextField from "../../../components/Textfield/TextField.jsx";
import IconArticleModify from "/iconAddArticleWhite.png";
import IconArticleModifyDark from "/iconAddArticleDark.png";

import Loading from "../../../components/Loading/Loading.jsx"

const FALLBACK_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export default function ArticlesContent() {
	const { theme } = useTheme();
	const API_URL = import.meta.env.VITE_API_URL;

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
	const [isRefreshTab, setIsRefreshTab] = useState(true);
	const [TabDataBody, setTabDataBody] = useState([]);

	const [search_Article_Value, setSearchArticleValue] = useState("");
	const lastRealtimeSyncRef = useRef(0);

	const reinit_AllArticles = useCallback(async ({ resetSearch = true } = {}) => {
		try {
			setIsRefreshTab(true);
			const resInit = await axios.get(`${API_URL}/api/articles/all`);
			if (resInit.status == 200)
				setAllArticles(resInit.data)
			else toast.error("Erreur d'initialisation des articles");
		} catch {
			toast.error("Erreur d'initialisation des articles");
		} finally {
			setIsRefreshTab(false);
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
		setIsRefreshTab(true);
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
		setIsRefreshTab(false);
	}, [allArticles]);

	// States pour le formulaire
	const [Id_clicked, setId_clicked] = useState(null);
	const [is_Add_article, setIsAddArticle] = useState(false);
	const [designation, setDesignation] = useState("");
	const [typeArticle, setTypeArticle] = useState("");
	const [qt, setQt] = useState("");
	const [mesure, setMesure] = useState("");
	const [seuil, setSeuil] = useState("");
	const [achat, setAchat] = useState("");
	const [vente, setVente] = useState("");

	const if_oneRowclicked = (id) => {
		setId_clicked(id);
		setIsAddArticle(false);

		const article = TabDataBody.find(item => item.ID === id);
		if (article) {
			setDesignation(article.designation);
			setTypeArticle(article.type);
			setQt(article.qt);
			setMesure(article.mesure);
			setSeuil(article.seuil);
			setAchat(article.achat);
			setVente(article.vente);
		}
	};

	const is_addArticleCliced = () => {
		setIsAddArticle(true);
		setId_clicked(null);

		setDesignation("");
		setTypeArticle("");
		setQt("");
		setMesure("");
		setSeuil("");
		setAchat("");
		setVente("");
	};

	const is_modifyArticle = async () => {
		try {
			if (!Id_clicked) {
				toast.error("Veuillez selectionner l'article");
				return;
			}
			if ((designation == "" || typeArticle == "" || qt == "" || mesure == "" || seuil == "" || achat == "" || vente == "")) {
				toast.error("Veuillez remplir le(s) champ(s)");
				console.log({designation, typeArticle, qt, mesure, seuil, achat, vente})
				return;
			}
			const resPatchArticle = await axios.patch(`${API_URL}/api/articles/${Id_clicked}`, {
				designation: designation,
				type: typeArticle,
				qt: qt,
				mesure: mesure,
				achat: achat,
				vente: vente,
				seuil: seuil
			})

			if (resPatchArticle.status == 200) {
				toast.success("Modification effectuée")
				await reinit_AllArticles();
			}
			else toast.error("La modification n'est pas faite")
		} catch (err) {
			console.log("Erreur modification article : " + err)
			toast.error("Une erreur s'est produite");
		}
	}

	const ajouter_larticle = async () => {
		if (designation == "" || typeArticle == "" || qt == "" || mesure == "" || seuil == "" || achat == "" || vente == "")
			toast.error("Veuillez remplir le(s) champ(s) ", { duration: 6000 });
		else {
			const res = await axios.post(`${API_URL}/api/articles`, {
				designation: designation,
				type: typeArticle,
				qt: qt,
				mesure: mesure,
				achat: achat,
				vente: vente,
				seuil: seuil
			})
			if (res.status == 200) {
				await reinit_AllArticles();
				toast.success("l'article a été ajouté");
			}
			else toast.error("l'article n'a pas été ajouté");
		}
	}

	const delete_one_article = async () => {
		try {
			if ((designation == "" || typeArticle == "" || qt == "" || mesure == "" || seuil == "" || achat == "" || vente == "")) {
				toast.error("Veuillez remplir le(s) champ(s)");
				return;
			}
			const resDeleteArticle = await axios.delete(`${API_URL}/api/articles/${Id_clicked}`)
			if (resDeleteArticle.status == 200) {
				toast.success(resDeleteArticle.data.message)
				await reinit_AllArticles();
			}
			else
				toast.error("La suppression n'a pas été faite");

		} catch (err) {
			toast.error("Erreur au suppression")
			console.log(err);
		}
	}

	const find_searchArticleValue = async (designation = search_Article_Value) => {
		const cleanedDesignation = String(designation ?? "").trim();

		if (cleanedDesignation === "") {
			await reinit_AllArticles({ resetSearch: false });
			return;
		}

		try {
			setIsRefreshTab(true);
			const resSearch = await axios.get(`${API_URL}/api/articles/search?designation=${encodeURIComponent(cleanedDesignation)}`)
			if (resSearch.status == 200)
				setAllArticles(resSearch.data)
			else toast.error("Search Error");
		} catch (err) {
			toast.error("Search Error");
			console.log(err);
		} finally {
			setIsRefreshTab(false);
		}
	}

	const handleArticleSearchKeyDown = (event) => {
		if (event.key === "Enter") {
			event.preventDefault();
			find_searchArticleValue(event.target.value);
		}
	};

	const optionsInputSearch = useMemo(() => {
		return TabDataBody.map(article => article.designation);
	}, [TabDataBody]);

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

	return (
		<>
			{/* leftPart */}
			<div className="leftPart">
				<div className="articlesModify"
					style={{ backgroundColor: theme === "light" ? "var(--whiteBeMax)" : "var(--noirbe)", paddingTop: "60px" }}
				>
					<div className="articleModifyTop">
						<img src={theme === "light" ? IconArticleModify : IconArticleModifyDark} alt="" />
					</div>
					<h4 style={{ textAlign: "center", marginBottom: "10px" }}>Gérer vos articles</h4>
					<div className={(Id_clicked != null || is_Add_article)
						? 'active_articleModify articlesBlockFormModify'
						: 'articlesBlockFormModify'}>
						<section className='atricleNothingToChange'>
							<h5>Veuillez selectionner un atricle</h5>
						</section>
						<section className='atricleToChange'>
							<div style={{ width: "100%", display: "flex", justifyContent: "space-between", marginTop: "30px" }}>
								<div style={{ marginTop: "10px", width: "100%" }}>
									<TextField Width={"100%"} Placeholder={"Désignation"} value={designation} onChangeValue={setDesignation} />
								</div>
							</div>
							<div style={{ width: "100%", display: "flex", justifyContent: "space-between", marginTop: "15px" }}>
								<div style={{ marginTop: "10px", width: "100%" }}>
									<TextField Width={"100%"} Placeholder={"Type de l'article"} value={typeArticle} onChangeValue={setTypeArticle} />
								</div>
							</div>
							<div style={{ width: "100%", display: "flex", justifyContent: "space-between", marginTop: "15px" }}>
								<div style={{ marginTop: "10px", width: "95%" }}>
									<TextField Width={"97%"} Placeholder={"Qt Actuel"} value={qt} onChangeValue={setQt} />
								</div>
								<div style={{ marginTop: "10px", width: "95%" }}>
									<TextField Width={"97%"} Placeholder={"Unité de mesure"} value={mesure} onChangeValue={setMesure} />
								</div>
								<div style={{ marginTop: "10px", width: "95%" }}>
									<TextField Width={"100%"} Placeholder={"Seuil d'Alerte"} value={seuil} onChangeValue={setSeuil} />
								</div>
							</div>
							<div style={{ width: "100%", display: "flex", justifyContent: "space-between", marginTop: "15px" }}>
								<div style={{ marginTop: "10px", width: "95%" }}>
									<TextField Width={"98%"} Placeholder={"Prix de revient"} value={achat} onChangeValue={setAchat} />
								</div>
								<div style={{ marginTop: "10px", width: "95%" }}>
									<TextField Width={"100%"} Placeholder={"Prix de vente"} value={vente} onChangeValue={setVente} />
								</div>
							</div>

							<div className='leftp-section-btn' style={{ width: "100%", display: is_Add_article === false ? "flex" : "none", justifyContent: "space-between", marginTop: "50px" }}>
								<BasicButton
									variant={"outlined"}
									color={"var(--ThemClaire)"}
									colorH={"var(--white)"}
									bgColor={"transparent"}
									bgColorH={"var(--ThemClaire)"}
									bgColorA={"var(--ThemClaire)"}
									brdrColor={"var(--ThemClaire)"}
									brdrColorH={"var(--ThemClaire)"}
									textBtn={"Modifier"}
									width={210}
									padding={"7px 0px 9px 0px"}
									onClick={is_modifyArticle}
								/>
								<BasicButton
									variant={"contained"}
									color={"var(--white)"}
									bgColor={"#f87269"}
									bgColorH={"#eb6258"}
									bgColorA={"#E42417"}
									brdrColor={"#f87269"}
									brdrColorH={"#eb6258"}
									textBtn={"Supprimer"}
									width={210}
									padding={"7.7px 0px 9px 0px"}
									onClick={delete_one_article}
								/>
							</div>

							<div style={{ width: "100%", display: is_Add_article === false ? "none" : "flex", justifyContent: "center", marginTop: "50px" }}>
								<BasicButton
									variant={"contained"}
									color={"var(--white)"}
									bgColor={"#f87269"}
									bgColorH={"#eb6258"}
									bgColorA={"#E42417"}
									brdrColor={"#f87269"}
									brdrColorH={"#eb6258"}
									textBtn={"Ajouter l'article"}
									width={430}
									padding={"7.7px 0px 9px 0px"}
									onClick={ajouter_larticle}
								/>
							</div>
						</section>
					</div>
				</div>
			</div>

			{/* rightPart */}
			<div className="rightPart">
				<div className="findSection">
					<h4>Liste des Articles</h4>
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
							textBtn={"Ajouter un article"}
							width={140}
							padding={"7.8px 0px 10px 0px"}
							onClick={is_addArticleCliced}
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
							textBtn={isRefreshTab ? "Actualisation..." : "Actualiser"}
							width={130}
							padding={"7.7px 0px 9px 0px"}
							onClick={reinit_AllArticles}
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
					</section>
				</div>

				<div className="tableAff" style={{ overflow: 'hidden', marginTop: "15px", width: "55.2vw" }}>
					<TableList
						TabLisHead={['Designation', 'Type', 'Qt', 'Mesure', 'Achat', 'Vente']}
						onRowClick={if_oneRowclicked}
						TabListBody={TabDataBody}
						createRow={createRow}
						isLoading={isRefreshTab}
					/>
				</div>
			</div>
		</>
	);
}
