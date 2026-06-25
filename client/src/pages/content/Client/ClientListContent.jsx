import React, { useCallback, useEffect, useMemo, useState } from 'react';
import "./ClientListStyle.css";
import { useNavigate } from "react-router-dom";

import { useTheme } from '../../../context/themeContext';
import axios from 'axios';
import { formatNumber } from '../../../services/formatNumber.js';
import { toast } from 'react-hot-toast';
import EditIco from "@mui/icons-material/EditOutlined";
import DeleteIco from "@mui/icons-material/DeleteOutline";
import IconButton from '@mui/material/IconButton';
import useRealtimeEvents from '../../../services/useRealtimeEvents';

import TableList from "../../../components/TableList/TableListReactif_delBtn.jsx";
import InputSearch from "../../../components/InputSearch/InputSearch.jsx";
import BasicButton from "../../../components/BasicButton/BasicButtons.jsx";
import TextField from "../../../components/Textfield/TextField.jsx";
import Loading from "../../../components/Loading/Loading.jsx";

export default function ClientListContent() {
	const { theme } = useTheme();
	const API_URL = import.meta.env.VITE_API_URL;
	const navigate = useNavigate();

	function createData(ID, nom, prenom, genre, adresse, numClient, numberCNI, dateCNI, lieuCNI, numTel, total_achat, total_reste) {
		return { ID, nom, prenom, genre, adresse, numClient, numberCNI, dateCNI, lieuCNI, numTel, total_achat, total_reste };
	}

	function createRow(row, index) {
		const fullName = row.prenom && row.prenom !== "-" ? `${row.nom} ${row.prenom}` : row.nom;
		return ({
			id: row.ID || index,
			nom: fullName,
			adresse: row.adresse,
			contact: row.numTel,
			total: row.total_achat,
			reste: row.total_reste
		});
	}

	const [allClients, setAllClients] = useState([]);
	const [TabDataBody, setTabDataBody] = useState([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isTabLoading, setIsTabLoading] = useState(true);
	const [search_Client_Value, setSearchClientValue] = useState("");

	const [isClientPopupOpen, setIsClientPopupOpen] = useState(false);
	const [isDeletePopupOpen, setIsDeletePopupOpen] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [popupMode, setPopupMode] = useState("create");
	const [editingClientId, setEditingClientId] = useState(null);
	const [deleteClientTarget, setDeleteClientTarget] = useState(null);

	const [clientNom, setClientNom] = useState("");
	const [clientAdresse, setClientAdresse] = useState("");
	const [clientContact, setClientContact] = useState("");

	const resetClientPopupForm = () => {
		setClientNom("");
		setClientAdresse("");
		setClientContact("");
	};

	const reinit_AllClients = useCallback(async ({ resetSearch = true } = {}) => {
		try {
			setIsTabLoading(true);
			const resInit = await axios.get(`${API_URL}/api/clients/all`);
			if (resInit.status === 200) {
				setAllClients(resInit.data);
			} else {
				toast.error("Erreur d'initialisation des clients");
			}
		} catch (err) {
			toast.error("Erreur d'initialisation des clients");
			console.log(err);
		} finally {
			setIsTabLoading(false);
			if (resetSearch) setSearchClientValue("");
		}
	}, [API_URL]);

	useEffect(() => {
		const init = async () => {
			setIsLoading(true);
			await reinit_AllClients({ resetSearch: false });
			setIsLoading(false);
		};

		init();
	}, [reinit_AllClients]);

	useEffect(() => {
		setTabDataBody(
			allClients.map((client) =>
				createData(
					client.id,
					client.nom,
					client.prenom,
					client.genre,
					client.adresse,
					client.numClient,
					client.numberCNI,
					client.dateCNI,
					client.lieuCNI,
					client.numTel,
					formatNumber(client.total_achat),
					formatNumber(client.total_reste)
				)
			)
		);
	}, [allClients]);

	useEffect(() => {
		if (!isClientPopupOpen && !isDeletePopupOpen) return undefined;

		const handleEscape = (event) => {
			if (event.key !== "Escape" || isSubmitting) return;

			if (isDeletePopupOpen) {
				setIsDeletePopupOpen(false);
				setDeleteClientTarget(null);
				return;
			}

			setIsClientPopupOpen(false);
			setPopupMode("create");
			setEditingClientId(null);
			resetClientPopupForm();
		};

		document.addEventListener("keydown", handleEscape);
		return () => document.removeEventListener("keydown", handleEscape);
	}, [isClientPopupOpen, isDeletePopupOpen, isSubmitting]);

	const find_client_byname = useCallback(async (clientName = search_Client_Value) => {
		const cleanedClientName = String(clientName ?? "").trim();

		if (cleanedClientName === "") {
			await reinit_AllClients({ resetSearch: false });
			return;
		}

		try {
			setIsTabLoading(true);
			const resFindClient = await axios.get(`${API_URL}/api/clients/search?nom=${encodeURIComponent(cleanedClientName)}`);
			if (resFindClient.status === 200) {
				setAllClients(resFindClient.data);
			} else {
				toast.error("Erreur de recherche client");
			}
		} catch (err) {
			toast.error("Erreur de recherche client");
			console.log(err);
		} finally {
			setIsTabLoading(false);
		}
	}, [API_URL, reinit_AllClients, search_Client_Value]);

	useRealtimeEvents(useCallback((event) => {
		if (!event || event.type !== "clients-updated") return;

		if (search_Client_Value.trim() !== "") {
			find_client_byname(search_Client_Value);
			return;
		}

		reinit_AllClients({ resetSearch: false });
	}, [find_client_byname, reinit_AllClients, search_Client_Value]));

	const optionsInputSearch = useMemo(() => {
		return TabDataBody.map((client) => client.nom);
	}, [TabDataBody]);

	const if_oneRowclicked = (id) => {
		const numericId = Number(id);
		if (!Number.isFinite(numericId) || numericId <= 0) return;
		navigate(`/admin/clients/${numericId}`);
	};

	const handleClientSearchKeyDown = (event) => {
		if (event.key === "Enter") {
			event.preventDefault();
			find_client_byname(event.target.value);
		}
	};

	const closeClientPopup = (force = false) => {
		if (isSubmitting && !force) return;
		setIsClientPopupOpen(false);
		setPopupMode("create");
		setEditingClientId(null);
		resetClientPopupForm();
	};

	const closeDeletePopup = (force = false) => {
		if (isSubmitting && !force) return;
		setIsDeletePopupOpen(false);
		setDeleteClientTarget(null);
	};

	const openCreatePopup = () => {
		setPopupMode("create");
		setEditingClientId(null);
		resetClientPopupForm();
		setIsClientPopupOpen(true);
	};

	const openEditPopup = (clientId) => {
		const client = allClients.find((item) => Number(item.id) === Number(clientId));
		if (!client) {
			toast.error("Client introuvable");
			return;
		}

		setPopupMode("edit");
		setEditingClientId(Number(client.id));
		setClientNom(String(client.nom ?? ""));
		setClientAdresse(String(client.adresse ?? ""));
		setClientContact(String(client.numTel ?? ""));
		setIsClientPopupOpen(true);
	};

	const openDeletePopup = (clientId) => {
		const client = allClients.find((item) => Number(item.id) === Number(clientId));
		if (!client) {
			toast.error("Client introuvable");
			return;
		}

		const displayName = client.prenom && client.prenom !== "-" ? `${client.nom} ${client.prenom}` : client.nom;
		setDeleteClientTarget({
			id: Number(client.id),
			nom: String(displayName ?? "")
		});
		setIsDeletePopupOpen(true);
	};

	const handleConfirmDeleteClient = async () => {
		if (isSubmitting || !deleteClientTarget?.id) return;

		try {
			setIsSubmitting(true);
			const resDeleteClient = await axios.delete(`${API_URL}/api/clients/${deleteClientTarget.id}`);
			if (resDeleteClient.status === 200) {
				toast.success("Client supprimé");
				closeDeletePopup(true);
				if (search_Client_Value.trim() !== "") {
					await find_client_byname(search_Client_Value);
				} else {
					await reinit_AllClients({ resetSearch: false });
				}
			}
		} catch (err) {
			if (err?.response?.status === 409) {
				toast.error("Impossible de supprimer ce client");
			} else {
				toast.error("Erreur de suppression client");
			}
			console.log(err);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleSubmitClient = async () => {
		if (isSubmitting) return;

		const cleanedNom = String(clientNom ?? "").trim();
		const cleanedAdresse = String(clientAdresse ?? "").trim();
		const cleanedContact = String(clientContact ?? "").trim();

		if (!cleanedNom || !cleanedAdresse || !cleanedContact) {
			toast.error("Veuillez remplir nom, adresse et contact");
			return;
		}

		try {
			setIsSubmitting(true);

			if (popupMode === "edit") {
				if (!editingClientId) {
					toast.error("Client introuvable");
					return;
				}

				const resUpdateClient = await axios.patch(`${API_URL}/api/clients/${editingClientId}`, {
					nom: cleanedNom,
					adresse: cleanedAdresse,
					numTel: cleanedContact
				});

				if (resUpdateClient.status === 200) {
					toast.success("Client modifié");
					closeClientPopup(true);
					if (search_Client_Value.trim() !== "") {
						await find_client_byname(search_Client_Value);
					} else {
						await reinit_AllClients({ resetSearch: false });
					}
				}
			} else {
				const resAddClient = await axios.post(`${API_URL}/api/clients`, {
					nom: cleanedNom,
					adresse: cleanedAdresse,
					numTel: cleanedContact
				});

				if (resAddClient.status === 201) {
					toast.success("Client ajouté");
					setSearchClientValue("");
					closeClientPopup(true);
					await reinit_AllClients({ resetSearch: false });
				}
			}
		} catch (err) {
			if (err?.response?.status === 409) {
				toast.error("Impossible d'enregistrer ce client");
			} else if (err?.response?.status === 400) {
				toast.error("Informations client invalides");
			} else {
				toast.error(popupMode === "edit" ? "Erreur de modification client" : "Erreur d'ajout client");
			}
			console.log(err);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleRefresh = async () => {
		await reinit_AllClients();
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

	return (
		<div className={`clientPage ${(isClientPopupOpen || isDeletePopupOpen) ? "popup-open" : ""}`}>
			<div className="rightPart client-main-content">
				<div className="findSection">
					<h4>Liste des Clients</h4>
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
							textBtn={"Ajouter un Client"}
							width={145}
							padding={"7.8px 0px 10px 0px"}
							onClick={openCreatePopup}
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
							textBtn={isTabLoading ? "Actualisation..." : "Actualiser"}
							width={130}
							padding={"7.7px 0px 9px 0px"}
							onClick={handleRefresh}
						/>
						<InputSearch value={search_Client_Value} onChangeValue={setSearchClientValue} options={optionsInputSearch} onKeyDown={handleClientSearchKeyDown} />
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
							onClick={find_client_byname}
						/>
					</section>
				</div>

				<div className="tableAff" style={{ overflow: 'hidden', marginTop: "15px" }}>
					<TableList
						TabLisHead={['Nom', 'Adresse', 'Contact', 'Total', 'Reste']}
						onRowClick={if_oneRowclicked}
						TabListBody={TabDataBody}
						createRow={createRow}
						isLoading={isTabLoading}
						actionColumn={{
							headerName: "Action",
							field: "action",
							flex: 0.85,
							minWidth: 110,
							renderCell: (params) => (
								<div className="client-row-actions">
									<IconButton
										size="small"
										onClick={(event) => {
											event.stopPropagation();
											openEditPopup(params.row.id);
										}}
										sx={{
											color: theme === "light" ? "var(--noirbe)" : "var(--whiteBe)",
											borderRadius: "8px",
											transition: "all 0.2s ease",
											"&:hover": {
												backgroundColor: theme === "light" ? "rgba(29, 29, 29, 0.12)" : "rgba(237, 241, 244, 0.14)",
												color: theme === "light" ? "var(--noirbe)" : "var(--white)"
											}
										}}
									>
										<EditIco sx={{ width: 20, height: 20 }} />
									</IconButton>
									<IconButton
										size="small"
										onClick={(event) => {
											event.stopPropagation();
											openDeletePopup(params.row.id);
										}}
										sx={{
											color: "var(--ThemClaire)",
											borderRadius: "8px",
											transition: "all 0.2s ease",
											"&:hover": {
												backgroundColor: "rgba(248, 114, 105, 0.16)",
												color: "var(--ThemDur)"
											},
											".MuiDataGrid-row.Mui-selected &": {
												color: theme === "light" ? "var(--noirbe)" : "var(--whiteBe)"
											},
											".MuiDataGrid-row.Mui-selected &:hover": {
												backgroundColor: theme === "light" ? "rgba(29, 29, 29, 0.12)" : "rgba(237, 241, 244, 0.14)",
												color: theme === "light" ? "var(--noirbe)" : "var(--whiteBe)"
											}
										}}
									>
										<DeleteIco sx={{ width: 20, height: 20 }} />
									</IconButton>
								</div>
							)
						}}
					/>
				</div>
			</div>

			{isClientPopupOpen && (
				<div className="client-popup-overlay" onClick={(event) => {
					if (event.target === event.currentTarget) closeClientPopup();
				}}>
					<div
						className="client-popup-content"
						style={{
							backgroundColor: theme === "light" ? "var(--whiteBeMax)" : "var(--noirbe)",
							boxShadow: theme === "light" ? "0 10px 30px rgba(0,0,0,0.18)" : "0 10px 30px rgba(0,0,0,0.4)"
						}}
						onClick={(event) => event.stopPropagation()}
					>
						<div className="client-popup-header">
							<h3>{popupMode === "edit" ? "Modifier le client" : "Ajouter un client"}</h3>
						</div>

						<div className="client-popup-form">
							<div className="client-popup-field">
								<TextField
									Width={"100%"}
									Placeholder={"Nom"}
									value={clientNom}
									onChangeValue={setClientNom}
								/>
							</div>
							<div className="client-popup-field">
								<TextField
									Width={"100%"}
									Placeholder={"Adresse"}
									value={clientAdresse}
									onChangeValue={setClientAdresse}
								/>
							</div>
							<div className="client-popup-field">
								<TextField
									Width={"100%"}
									Placeholder={"Contact"}
									value={clientContact}
									onChangeValue={setClientContact}
								/>
							</div>
						</div>

						<div className="client-popup-actions">
							<BasicButton
								variant={"outlined"}
								color={"var(--ThemClaire)"}
								colorH={"var(--white)"}
								bgColor={"transparent"}
								bgColorH={"var(--ThemClaire)"}
								bgColorA={"var(--ThemClaire)"}
								brdrColor={"var(--ThemClaire)"}
								brdrColorH={"var(--ThemClaire)"}
								textBtn={"Retour"}
								width={110}
								padding={"7.7px 0px 9px 0px"}
								onClick={closeClientPopup}
							/>
							<BasicButton
								variant={"contained"}
								color={"var(--white)"}
								bgColor={"#f87269"}
								bgColorH={"#eb6258"}
								bgColorA={"#E42417"}
								brdrColor={"#f87269"}
								brdrColorH={"#eb6258"}
								textBtn={
									isSubmitting
										? (popupMode === "edit" ? "Modification..." : "Ajout...")
										: (popupMode === "edit" ? "Modifier" : "Ajouter")
								}
								width={110}
								padding={"7.7px 0px 9px 0px"}
								onClick={handleSubmitClient}
							/>
						</div>
					</div>
				</div>
			)}

			{isDeletePopupOpen && (
				<div className="client-popup-overlay" onClick={(event) => {
					if (event.target === event.currentTarget) closeDeletePopup();
				}}>
					<div
						className="client-popup-content client-delete-popup"
						style={{
							backgroundColor: theme === "light" ? "var(--whiteBeMax)" : "var(--noirbe)",
							boxShadow: theme === "light" ? "0 10px 30px rgba(0,0,0,0.18)" : "0 10px 30px rgba(0,0,0,0.4)"
						}}
						onClick={(event) => event.stopPropagation()}
					>
						<div className="client-popup-header">
							<h3>Confirmation suppression</h3>
						</div>

						<p className="client-delete-text">
							Voulez-vous vraiment supprimer le client
							<strong> {deleteClientTarget?.nom || ""}</strong> ?
						</p>

						<div className="client-popup-actions">
							<BasicButton
								variant={"outlined"}
								color={"var(--ThemClaire)"}
								colorH={"var(--white)"}
								bgColor={"transparent"}
								bgColorH={"var(--ThemClaire)"}
								bgColorA={"var(--ThemClaire)"}
								brdrColor={"var(--ThemClaire)"}
								brdrColorH={"var(--ThemClaire)"}
								textBtn={"Annuler"}
								width={110}
								padding={"7.7px 0px 9px 0px"}
								onClick={closeDeletePopup}
							/>
							<BasicButton
								variant={"contained"}
								color={"var(--white)"}
								bgColor={"#f87269"}
								bgColorH={"#eb6258"}
								bgColorA={"#E42417"}
								brdrColor={"#f87269"}
								brdrColorH={"#eb6258"}
								textBtn={isSubmitting ? "Suppression..." : "Oui"}
								width={110}
								padding={"7.7px 0px 9px 0px"}
								onClick={handleConfirmDeleteClient}
							/>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
