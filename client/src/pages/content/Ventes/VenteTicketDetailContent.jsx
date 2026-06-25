import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import IconButton from "@mui/material/IconButton";
import EditIco from "@mui/icons-material/EditOutlined";
import DeleteIco from "@mui/icons-material/DeleteOutline";
import MuiTextField from "@mui/material/TextField";
import MuiButton from "@mui/material/Button";

import "./VentesListStyle.css";

import { useTheme } from "../../../context/themeContext";
import { formatNumberWithSpace } from "../../../services/formatNumber.js";
import useRealtimeEvents from "../../../services/useRealtimeEvents.js";
import axios from "axios";

import BasicButton from "../../../components/BasicButton/BasicButtons.jsx";
import InputSearch from "../../../components/InputSearch/InputSearch.jsx";
import TableList from "../../../components/TableList/TableListReactif_delBtn.jsx";
import TextField from "../../../components/Textfield/TextField.jsx";
import Loading from "../../../components/Loading/Loading.jsx";

const formatTicketNumber = (id) => {
	const safeId = Number(id) || 0;
	return `TK-${String(safeId).padStart(6, "0")}`;
};

const formatTicketDate = (value) => {
	if (!value) return "-";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "-";

	return date.toLocaleString("fr-FR", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit"
	});
};

const formatPaymentType = (value) => {
	switch (String(value ?? "").toLowerCase()) {
		case "comptant":
			return "Au comptant";
		case "attente":
			return "En attente";
		default:
			return "En attente";
	}
};

const sanitizePositiveIntegerInput = (value) => {
	const cleaned = String(value ?? "").replace(/[^\d]/g, "");
	if (!cleaned) return "";
	return String(Number(cleaned));
};

export default function VenteTicketDetailContent() {
	const { theme } = useTheme();
	const API_URL = import.meta.env.VITE_API_URL;
	const location = useLocation();
	const navigate = useNavigate();
	const { ticketId } = useParams();
	const lastRealtimeSyncRef = useRef(0);
	const isDeletingTicketRef = useRef(false);

	const ticketIdNumber = Number(ticketId);

	const [ticket, setTicket] = useState(null);
	const [ticketItems, setTicketItems] = useState([]);
	const [allArticles, setAllArticles] = useState([]);

	const [isLoading, setIsLoading] = useState(true);
	const [isTabLoading, setIsTabLoading] = useState(true);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const [isAddPopupOpen, setIsAddPopupOpen] = useState(false);
	const [isEditPopupOpen, setIsEditPopupOpen] = useState(false);
	const [isDeleteItemPopupOpen, setIsDeleteItemPopupOpen] = useState(false);
	const [isDeleteTicketPopupOpen, setIsDeleteTicketPopupOpen] = useState(false);
	const [isPayPopupOpen, setIsPayPopupOpen] = useState(false);

	const [addArticleSearchValue, setAddArticleSearchValue] = useState("");
	const [appliedAddArticleSearchValue, setAppliedAddArticleSearchValue] = useState("");
	const [addQtyByArticleId, setAddQtyByArticleId] = useState({});
	const [addingArticleId, setAddingArticleId] = useState(null);
	const [payingTicketId, setPayingTicketId] = useState(null);
	const [payTarget, setPayTarget] = useState(null);
	const [montantRecuInput, setMontantRecuInput] = useState("");
	const [editQty, setEditQty] = useState("1");
	const [editItemTarget, setEditItemTarget] = useState(null);
	const [deleteItemTarget, setDeleteItemTarget] = useState(null);

	const canEditTicket = useMemo(() => {
		if (!ticket) return false;
		const type = String(ticket.type_paiement ?? "").toLowerCase();
		const reste = Number(ticket.reste) || 0;
		return type === "attente" && reste > 0;
	}, [ticket]);

	const isTicketUnpaid = useMemo(() => {
		return (Number(ticket?.reste) || 0) > 0;
	}, [ticket]);

	const backPath = useMemo(() => {
		const maybeReturnTo = location?.state?.returnTo;
		if (typeof maybeReturnTo === "string" && maybeReturnTo.startsWith("/admin/")) {
			return maybeReturnTo;
		}
		return "/admin/ventes";
	}, [location]);

	const availableArticlesForAdd = useMemo(() => {
		const alreadyAddedArticleIds = new Set(
			ticketItems
				.map((item) => Number(item.article_id))
				.filter((value) => Number.isFinite(value) && value > 0)
		);

		return allArticles.filter((article) => {
			const articleId = Number(article.id);
			const articleStock = Number(article.qt) || 0;
			const articleName = String(article.designation ?? "").trim();

			return (
				Number.isFinite(articleId) &&
				articleId > 0 &&
				articleStock > 0 &&
				articleName.length > 0 &&
				!alreadyAddedArticleIds.has(articleId)
			);
		});
	}, [allArticles, ticketItems]);

	const optionsArticleSearch = useMemo(() => {
		return Array.from(
			new Set(
				availableArticlesForAdd
					.map((article) => String(article.designation ?? "").trim())
					.filter(Boolean)
			)
		);
	}, [availableArticlesForAdd]);

	const filteredAvailableArticles = useMemo(() => {
		const cleanedSearch = String(appliedAddArticleSearchValue ?? "").trim().toLowerCase();
		if (!cleanedSearch) return availableArticlesForAdd;

		return availableArticlesForAdd.filter((article) => {
			const searchableValues = [
				article.designation,
				article.type,
				article.mesure
			];

			return searchableValues.some((value) =>
				String(value ?? "").toLowerCase().includes(cleanedSearch)
			);
		});
	}, [availableArticlesForAdd, appliedAddArticleSearchValue]);

	const addArticleRows = useMemo(() => {
		return filteredAvailableArticles.map((article) => ({
			ID: article.id,
			designation: String(article.designation ?? "-"),
			type: String(article.type ?? "-"),
			qt: Number(article.qt) || 0,
			mesure: String(article.mesure ?? "-"),
			achat: `${formatNumberWithSpace(article.achat)} Ar`,
			vente: `${formatNumberWithSpace(article.vente)} Ar`
		}));
	}, [filteredAvailableArticles]);

	const parsePositiveInt = (value) => {
		const parsed = Number(String(value ?? "").trim());
		if (!Number.isInteger(parsed) || parsed <= 0) return null;
		return parsed;
	};

	const parseMontantInput = (value) => {
		const cleaned = String(value ?? "").trim().replace(/\s/g, "").replace(",", ".");
		if (!cleaned) return { isValid: false, value: 0 };

		const parsed = Number(cleaned);
		if (!Number.isFinite(parsed) || parsed < 0) return { isValid: false, value: 0 };

		return { isValid: true, value: parsed };
	};

	const closePayPopup = useCallback((force = false) => {
		if ((isSubmitting || payingTicketId) && !force) return;
		setIsPayPopupOpen(false);
		setPayTarget(null);
		setMontantRecuInput("");
	}, [isSubmitting, payingTicketId]);

	const payTargetReste = Math.max(0, Number(payTarget?.reste) || 0);
	const parsedMontantRecu = parseMontantInput(montantRecuInput);
	const montantRecuValue = parsedMontantRecu.isValid ? parsedMontantRecu.value : 0;
	const montantARendre = Math.max(0, montantRecuValue - payTargetReste);
	const resteApresPaiement = Math.max(0, payTargetReste - montantRecuValue);

	const loadTicketData = useCallback(async ({ silent = false } = {}) => {
		if (!Number.isFinite(ticketIdNumber) || ticketIdNumber <= 0) {
			toast.error("Ticket invalide");
			navigate("/admin/ventes");
			return;
		}

		try {
			if (!silent) setIsLoading(true);
			setIsTabLoading(true);

			const [ticketRes, itemsRes] = await Promise.all([
				axios.get(`${API_URL}/api/tickets/${ticketIdNumber}`),
				axios.get(`${API_URL}/api/tickets/${ticketIdNumber}/items`)
			]);

			setTicket(ticketRes.data);
			setTicketItems(itemsRes.data);
		} catch (err) {
			if (isDeletingTicketRef.current) {
				navigate("/admin/ventes");
				return;
			}
			toast.error("Ticket introuvable");
			navigate("/admin/ventes");
			console.log(err);
		} finally {
			setIsLoading(false);
			setIsTabLoading(false);
		}
	}, [API_URL, navigate, ticketIdNumber]);

	const loadArticles = useCallback(async () => {
		try {
			const res = await axios.get(`${API_URL}/api/articles/all`);
			if (res.status === 200) {
				setAllArticles(res.data);
				return Array.isArray(res.data) ? res.data : [];
			}
		} catch (err) {
			toast.error("Erreur de chargement des articles");
			console.log(err);
		}
		return [];
	}, [API_URL]);

	useEffect(() => {
		loadTicketData();
	}, [loadTicketData]);

	useRealtimeEvents(useCallback((event) => {
		if (!event || !["tickets-updated", "stock-updated"].includes(event.type)) return;
		if (isDeletingTicketRef.current) return;

		const now = Date.now();
		if (now - lastRealtimeSyncRef.current < 1500) return;
		lastRealtimeSyncRef.current = now;

		loadTicketData({ silent: true });
	}, [loadTicketData]));

	useEffect(() => {
		if (
			!isAddPopupOpen &&
			!isEditPopupOpen &&
			!isDeleteItemPopupOpen &&
			!isDeleteTicketPopupOpen &&
			!isPayPopupOpen
		) return undefined;

		const handleEscape = (event) => {
			if (event.key !== "Escape") return;

			if (isPayPopupOpen) {
				closePayPopup();
			}
			if (isSubmitting) return;

			setIsAddPopupOpen(false);
			setIsEditPopupOpen(false);
			setIsDeleteItemPopupOpen(false);
			setIsDeleteTicketPopupOpen(false);
			setEditItemTarget(null);
			setDeleteItemTarget(null);
		};

		document.addEventListener("keydown", handleEscape);
		return () => document.removeEventListener("keydown", handleEscape);
	}, [
		closePayPopup,
		isAddPopupOpen,
		isDeleteItemPopupOpen,
		isDeleteTicketPopupOpen,
		isEditPopupOpen,
		isPayPopupOpen,
		isSubmitting
	]);

	const tableRows = useMemo(() => {
		return ticketItems.map((item) => ({
			ID: item.id,
			designation: String(item.designation ?? "-"),
			qt: Number(item.qt) || 0,
			mesure: String(item.mesure ?? "-"),
			prixu: `${formatNumberWithSpace(item.prix_u)} Ar`,
			total: `${formatNumberWithSpace(item.prix_total)} Ar`
		}));
	}, [ticketItems]);

	const createRow = (row, index) => ({
		id: row.ID || index,
		designation: row.designation,
		qt: row.qt,
		mesure: row.mesure,
		prixu: row.prixu,
		total: row.total
	});

	const createAddArticleRow = (row, index) => ({
		id: row.ID || index,
		designation: row.designation,
		type: row.type,
		qt: row.qt,
		mesure: row.mesure,
		achat: row.achat,
		vente: row.vente
	});

	const openPayPopup = () => {
		if (!ticket || isSubmitting || payingTicketId) return;

		const numericId = Number(ticket.id ?? ticketIdNumber);
		if (!Number.isFinite(numericId) || numericId <= 0) {
			toast.error("Ticket introuvable");
			return;
		}

		const reste = Math.max(0, Number(ticket.reste) || 0);
		if (reste <= 0) {
			toast.error("Ce ticket est déjà payé");
			return;
		}

		setPayTarget({
			id: numericId,
			ticket: formatTicketNumber(numericId),
			client: String(ticket.client_nom ?? "-"),
			reste
		});
		setMontantRecuInput("");
		setIsPayPopupOpen(true);
	};

	const openAddPopup = async () => {
		if (!canEditTicket) {
			toast.error("Seuls les tickets en attente peuvent être modifiés");
			return;
		}

		let loadedArticles = allArticles;
		if (loadedArticles.length === 0) {
			loadedArticles = await loadArticles();
		}

		const alreadyAddedArticleIds = new Set(
			ticketItems
				.map((item) => Number(item.article_id))
				.filter((value) => Number.isFinite(value) && value > 0)
		);

		const hasAvailableArticles = loadedArticles.some((article) => {
			const articleId = Number(article.id);
			const articleStock = Number(article.qt) || 0;
			return (
				Number.isFinite(articleId) &&
				articleId > 0 &&
				articleStock > 0 &&
				!alreadyAddedArticleIds.has(articleId)
			);
		});

		if (!hasAvailableArticles) {
			toast.error("Aucun article disponible à ajouter sur ce ticket");
			return;
		}

		setAddArticleSearchValue("");
		setAppliedAddArticleSearchValue("");
		setAddQtyByArticleId({});
		setIsAddPopupOpen(true);
	};

	const applyAddArticleSearch = useCallback((searchValue = addArticleSearchValue) => {
		setAppliedAddArticleSearchValue(String(searchValue ?? "").trim());
	}, [addArticleSearchValue]);

	const handleAddArticleSearchKeyDown = (event) => {
		if (event.key === "Enter") {
			event.preventDefault();
			applyAddArticleSearch(event.target.value);
		}
	};

	const openEditPopup = (itemId) => {
		if (!canEditTicket) {
			toast.error("Ticket non modifiable");
			return;
		}

		const item = ticketItems.find((entry) => Number(entry.id) === Number(itemId));
		if (!item) {
			toast.error("Item introuvable");
			return;
		}

		setEditItemTarget(item);
		setEditQty(String(item.qt ?? 1));
		setIsEditPopupOpen(true);
	};

	const openDeleteItemPopup = (itemId) => {
		if (!canEditTicket) {
			toast.error("Ticket non modifiable");
			return;
		}

		const item = ticketItems.find((entry) => Number(entry.id) === Number(itemId));
		if (!item) {
			toast.error("Item introuvable");
			return;
		}

		setDeleteItemTarget(item);
		setIsDeleteItemPopupOpen(true);
	};

	const handleQtyDraftChange = (articleId, value) => {
		const normalizedId = Number(articleId);
		if (!Number.isFinite(normalizedId) || normalizedId <= 0) return;

		const normalizedValue = sanitizePositiveIntegerInput(value);
		setAddQtyByArticleId((prev) => ({
			...prev,
			[normalizedId]: normalizedValue
		}));
	};

	const resolveDraftQty = (articleId) => {
		const normalizedId = Number(articleId);
		if (!Number.isFinite(normalizedId) || normalizedId <= 0) return "1";

		return String(addQtyByArticleId[normalizedId] ?? "1");
	};

	const handleAddItem = async (articleId) => {
		if (!canEditTicket || isSubmitting) return;

		const normalizedArticleId = Number(articleId);
		if (!Number.isFinite(normalizedArticleId) || normalizedArticleId <= 0) {
			toast.error("Article invalide");
			return;
		}

		const qty = parsePositiveInt(resolveDraftQty(normalizedArticleId));
		if (!qty) {
			toast.error("Quantité invalide");
			return;
		}

		const article = availableArticlesForAdd.find(
			(entry) => Number(entry.id) === normalizedArticleId
		);
		if (!article) {
			toast.error("Article indisponible ou déjà présent dans ce ticket");
			return;
		}

		const articleStock = Number(article.qt) || 0;
		if (articleStock < qty) {
			toast.error("Stock insuffisant pour la quantité demandée");
			return;
		}

		try {
			setAddingArticleId(normalizedArticleId);
			setIsSubmitting(true);
			const res = await axios.post(`${API_URL}/api/tickets/${ticketIdNumber}/items`, {
				article_id: normalizedArticleId,
				qt: qty
			});

			if (res.status === 201) {
				toast.success("Article ajouté au ticket");
				setAddQtyByArticleId((prev) => ({
					...prev,
					[normalizedArticleId]: "1"
				}));
				await Promise.all([
					loadTicketData({ silent: true }),
					loadArticles()
				]);
			}
		} catch (err) {
			toast.error(err?.response?.data?.error || "Impossible d'ajouter cet article");
			console.log(err);
		} finally {
			setIsSubmitting(false);
			setAddingArticleId(null);
		}
	};

	const handleConfirmPayTicket = async () => {
		const numericId = Number(payTarget?.id);
		if (!Number.isFinite(numericId) || numericId <= 0 || isSubmitting || payingTicketId) return;
		if (!parsedMontantRecu.isValid || montantRecuValue <= 0) {
			toast.error("Montant reçu invalide");
			return;
		}

		try {
			setPayingTicketId(numericId);
			setIsSubmitting(true);
			const response = await axios.patch(`${API_URL}/api/tickets/${numericId}/pay`, {
				montant_recu: montantRecuValue
			});
			if (response.status === 200) {
				toast.success(response.data?.message || "Paiement enregistré");
				closePayPopup(true);
				await loadTicketData({ silent: true });
			} else {
				toast.error("Paiement impossible");
			}
		} catch (err) {
			toast.error("Erreur de paiement");
			console.log(err);
		} finally {
			setIsSubmitting(false);
			setPayingTicketId(null);
		}
	};

	const handleUpdateItemQty = async () => {
		if (!editItemTarget || isSubmitting || !canEditTicket) return;

		const qty = parsePositiveInt(editQty);
		if (!qty) {
			toast.error("Quantité invalide");
			return;
		}

		try {
			setIsSubmitting(true);
			const res = await axios.patch(`${API_URL}/api/tickets/${ticketIdNumber}/items/${editItemTarget.id}`, {
				qt: qty
			});

			if (res.status === 200) {
				toast.success("Quantité mise à jour");
				setIsEditPopupOpen(false);
				setEditItemTarget(null);
				await loadTicketData({ silent: true });
			}
		} catch (err) {
			toast.error(err?.response?.data?.error || "Impossible de modifier cet item");
			console.log(err);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleDeleteItem = async () => {
		if (!deleteItemTarget || isSubmitting || !canEditTicket) return;

		try {
			setIsSubmitting(true);
			const res = await axios.delete(`${API_URL}/api/tickets/${ticketIdNumber}/items/${deleteItemTarget.id}`);
			if (res.status === 200) {
				toast.success("Item supprimé");
				setIsDeleteItemPopupOpen(false);
				setDeleteItemTarget(null);
				await loadTicketData({ silent: true });
			}
		} catch (err) {
			toast.error(err?.response?.data?.error || "Impossible de supprimer cet item");
			console.log(err);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleDeleteTicket = async () => {
		if (isSubmitting) return;

		try {
			isDeletingTicketRef.current = true;
			setIsSubmitting(true);
			const res = await axios.delete(`${API_URL}/api/tickets/${ticketIdNumber}`);
			if (res.status === 200) {
				toast.success("Ticket supprimé");
				navigate("/admin/ventes");
			}
		} catch (err) {
			isDeletingTicketRef.current = false;
			toast.error(err?.response?.data?.error || "Impossible de supprimer ce ticket");
			console.log(err);
		} finally {
			setIsSubmitting(false);
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
				<Loading />
			</div>
		);
	}

	return (
		<div className={`salesPage ticket-detail-page ${(isAddPopupOpen || isEditPopupOpen || isDeleteItemPopupOpen || isDeleteTicketPopupOpen || isPayPopupOpen) ? "popup-open" : ""}`}>
			<div className="rightPart sales-main-content">
				<div className="sales-detail-toolbar">
					<div className="sales-detail-actions">
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
							width={95}
							padding={"7.7px 0px 9px 0px"}
							onClick={() => navigate(backPath)}
						/>
						{isTicketUnpaid && (
							<BasicButton
								variant={"outlined"}
								color={"var(--ThemClaire)"}
								colorH={"var(--white)"}
								bgColor={"transparent"}
								bgColorH={"var(--ThemClaire)"}
								bgColorA={"var(--ThemClaire)"}
								brdrColor={"var(--ThemClaire)"}
								brdrColorH={"var(--ThemClaire)"}
								textBtn={payingTicketId ? "Validation..." : "Payer"}
								width={95}
								padding={"7.7px 0px 9px 0px"}
								onClick={openPayPopup}
							/>
						)}
						<BasicButton
							variant={"outlined"}
							color={canEditTicket ? "var(--ThemClaire)" : "var(--whiteTransp)"}
							colorH={"var(--white)"}
							bgColor={"transparent"}
							bgColorH={canEditTicket ? "var(--ThemClaire)" : "var(--whiteTransp)"}
							bgColorA={canEditTicket ? "var(--ThemClaire)" : "var(--whiteTransp)"}
							brdrColor={canEditTicket ? "var(--ThemClaire)" : "var(--whiteTransp)"}
							brdrColorH={canEditTicket ? "var(--ThemClaire)" : "var(--whiteTransp)"}
							textBtn={"Ajouter un article"}
							width={150}
							padding={"7.7px 0px 9px 0px"}
							onClick={openAddPopup}
						/>
						<BasicButton
							variant={"outlined"}
							color={canEditTicket ? "var(--ThemClaire)" : "var(--whiteTransp)"}
							colorH={"var(--white)"}
							bgColor={"transparent"}
							bgColorH={canEditTicket ? "var(--ThemClaire)" : "var(--whiteTransp)"}
							bgColorA={canEditTicket ? "var(--ThemClaire)" : "var(--whiteTransp)"}
							brdrColor={canEditTicket ? "var(--ThemClaire)" : "var(--whiteTransp)"}
							brdrColorH={canEditTicket ? "var(--ThemClaire)" : "var(--whiteTransp)"}
							textBtn={"Supprimer ticket"}
							width={150}
							padding={"7.7px 0px 9px 0px"}
							onClick={() => {
								if (!canEditTicket) {
									toast.error("Seuls les tickets en attente peuvent être supprimés");
									return;
								}
								setIsDeleteTicketPopupOpen(true);
							}}
						/>
					</div>
				</div>

				<div className="sales-detail-summary">
					<h4>
						Détail du ticket <span className="sales-ticket-id">{formatTicketNumber(ticket?.id)}</span>
					</h4>
					<div className="sales-detail-grid">
						<div><strong>Client :</strong> {ticket?.client_nom || "Client inconnu"}</div>
						<div><strong>Date :</strong> {formatTicketDate(ticket?.date_ticket)}</div>
						<div><strong>Table :</strong> {ticket?.table_num || "-"}</div>
						<div><strong>Serveur(se) :</strong> {ticket?.servi_par || "-"}</div>
						<div><strong>Type :</strong> {formatPaymentType(ticket?.type_paiement)}</div>
						<div><strong>Total ticket :</strong> {formatNumberWithSpace(ticket?.total_ticket)} Ar</div>
						<div><strong>Montant payé :</strong> {formatNumberWithSpace(ticket?.montant_paye)} Ar</div>
						<div><strong>Reste :</strong> {formatNumberWithSpace(ticket?.reste)} Ar</div>
					</div>
					{!canEditTicket && (
						<p className="sales-detail-note">
							Ce ticket est clôturé. Les modifications d'items sont désactivées.
						</p>
					)}
				</div>

				<div className="tableAff" style={{ overflow: "hidden", marginTop: "15px" }}>
					<TableList
						TabLisHead={["Designation", "Qt", "Mesure", "PrixU", "Total"]}
						onRowClick={(id) => id}
						TabListBody={tableRows}
						createRow={createRow}
						isLoading={isTabLoading}
						actionColumn={{
							headerName: "Action",
							field: "action",
							flex: 1.1,
							minWidth: 155,
							renderCell: (params) => {
								if (!canEditTicket) return null;
								return (
									<div className="ticket-detail-row-actions">
										<IconButton
											size="small"
											onClick={(event) => {
												event.stopPropagation();
												openEditPopup(params.row.id);
											}}
											sx={{
												color: theme === "light" ? "var(--noirbe)" : "var(--whiteBe)",
												borderRadius: "8px",
												"&:hover": {
													backgroundColor: theme === "light" ? "rgba(29,29,29,0.12)" : "rgba(237,241,244,0.14)"
												}
											}}
										>
											<EditIco sx={{ width: 20, height: 20 }} />
										</IconButton>
										<IconButton
											size="small"
											onClick={(event) => {
												event.stopPropagation();
												openDeleteItemPopup(params.row.id);
											}}
											sx={{
												color: "var(--ThemClaire)",
												borderRadius: "8px",
												"&:hover": {
													backgroundColor: "rgba(248,114,105,0.16)",
													color: "var(--ThemDur)"
												},
												".MuiDataGrid-row.Mui-selected &": {
													color: theme === "light" ? "var(--noirbe)" : "var(--whiteBe)"
												},
												".MuiDataGrid-row.Mui-selected &:hover": {
													backgroundColor: theme === "light" ? "rgba(29,29,29,0.12)" : "rgba(237,241,244,0.14)",
													color: theme === "light" ? "var(--noirbe)" : "var(--whiteBe)"
												},
												marginLeft: "10px"
											}}
										>
											<DeleteIco sx={{ width: 20, height: 20 }} />
										</IconButton>
									</div>
								);
							}
						}}
					/>
				</div>
			</div>

			{isPayPopupOpen && payTarget && (
				<div
					className="sales-pay-overlay"
					onClick={(event) => {
						if (event.target === event.currentTarget) closePayPopup();
					}}
				>
					<div
						className="sales-pay-popup"
						style={{
							backgroundColor: theme === "light" ? "var(--whiteBeMax)" : "var(--noirbe)",
							boxShadow: theme === "light" ? "0 10px 30px rgba(0,0,0,0.18)" : "0 10px 30px rgba(0,0,0,0.4)"
						}}
						onClick={(event) => event.stopPropagation()}
					>
						<div className="sales-pay-header">
							<h3>
								Paiement du ticket{" "}
								<span className="sales-ticket-id">{payTarget.ticket}</span>
							</h3>
						</div>

						<p className="sales-pay-line">
							Client : <strong>{payTarget.client}</strong>
						</p>
						<p className="sales-pay-line">
							Reste actuel : <strong>{formatNumberWithSpace(payTargetReste)} Ar</strong>
						</p>

						<div className="sales-pay-input">
							<TextField
								Width={"100%"}
								Placeholder={"Montant reçu"}
								value={montantRecuInput}
								onChangeValue={setMontantRecuInput}
								disabled={Boolean(payingTicketId)}
							/>
						</div>

						<div className="sales-pay-summary">
							<p>A rendre : <strong>{formatNumberWithSpace(montantARendre)} Ar</strong></p>
							<p>Reste après paiement : <strong>{formatNumberWithSpace(resteApresPaiement)} Ar</strong></p>
						</div>

						<div className="sales-pay-actions">
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
								onClick={closePayPopup}
							/>
							<BasicButton
								variant={"contained"}
								color={"var(--white)"}
								bgColor={"#f87269"}
								bgColorH={"#eb6258"}
								bgColorA={"#E42417"}
								brdrColor={"#f87269"}
								brdrColorH={"#eb6258"}
								textBtn={payingTicketId ? "Validation..." : "Valider"}
								width={110}
								padding={"7.7px 0px 9px 0px"}
								onClick={handleConfirmPayTicket}
							/>
						</div>
					</div>
				</div>
			)}

			{isAddPopupOpen && (
				<div className="sales-modal-overlay" onClick={(event) => {
					if (event.target === event.currentTarget && !isSubmitting) setIsAddPopupOpen(false);
				}}>
					<div className="sales-modal-content sales-modal-large" style={{
						backgroundColor: theme === "light" ? "var(--whiteBeMax)" : "var(--noirbe)",
						boxShadow: theme === "light" ? "0 10px 30px rgba(0,0,0,0.18)" : "0 10px 30px rgba(0,0,0,0.4)"
					}}>
						<div className="sales-modal-header">
							<h3 className="sales-modal-title-accent">Ajouter un article</h3>
						</div>
						<div className="sales-add-toolbar">
							<InputSearch
								value={addArticleSearchValue}
								onChangeValue={setAddArticleSearchValue}
								options={optionsArticleSearch}
								label={"Rechercher un article"}
								onKeyDown={handleAddArticleSearchKeyDown}
							/>
							<BasicButton
								variant={"contained"}
								color={"var(--white)"}
								bgColor={"#f87269"}
								bgColorH={"#eb6258"}
								bgColorA={"#E42417"}
								brdrColor={"#f87269"}
								brdrColorH={"#eb6258"}
								textBtn={"Rechercher"}
								width={104}
								padding={"7.7px 0px 9px 0px"}
								onClick={applyAddArticleSearch}
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
								textBtn={"Réinitialiser"}
								width={110}
								padding={"7.7px 0px 9px 0px"}
								onClick={() => {
									setAddArticleSearchValue("");
									setAppliedAddArticleSearchValue("");
								}}
							/>
						</div>
						<div className="sales-add-table">
							<TableList
								TabLisHead={["Designation", "Type", "Qt", "Mesure", "Achat", "Vente"]}
								TabListBody={addArticleRows}
								createRow={createAddArticleRow}
								isLoading={isSubmitting && addingArticleId === null}
								columnFlexOverrides={{
									designation: 1.65,
									type: 1,
									qt: 0.75,
									mesure: 0.9,
									achat: 0.95,
									vente: 0.95
								}}
								columnMinWidthOverrides={{
									designation: 180,
									type: 110,
									qt: 90,
									mesure: 95,
									achat: 110,
									vente: 110
								}}
								actionColumn={{
									headerName: "Ajout",
									field: "action",
									flex: 1.85,
									minWidth: 250,
									renderCell: (params) => {
										const articleId = Number(params.row.id);
										const isRowAdding = addingArticleId === articleId && isSubmitting;
										const stopCellEvent = (event) => {
											event.stopPropagation();
										};

										return (
											<div
												className="ticket-detail-add-actions"
												onClick={stopCellEvent}
												onMouseDown={stopCellEvent}
											>
														<MuiTextField
															size="small"
															value={resolveDraftQty(articleId)}
														onChange={(event) => handleQtyDraftChange(articleId, event.target.value)}
														onClick={stopCellEvent}
														onMouseDown={stopCellEvent}
														onKeyDown={stopCellEvent}
														placeholder="Qt"
														disabled={isSubmitting}
															inputProps={{ min: 1, inputMode: "numeric", pattern: "[0-9]*" }}
																sx={{
																	width: 84,
																	"& .MuiOutlinedInput-root": {
																		height: 32,
																	},
																	"& .MuiInputBase-input": {
																		fontSize: "14px",
																		fontWeight: 500,
																		padding: "6px 7px",
																		textAlign: "center",
																		color: theme === "light" ? "var(--noirbe)" : "var(--whiteBe)"
																	},
														"& .MuiOutlinedInput-root fieldset": {
															borderColor: theme === "light" ? "var(--noirbeBorder)" : "var(--whiteTransp)"
														},
														"& .MuiOutlinedInput-root:hover fieldset": {
															borderColor: theme === "light" ? "var(--noirbeBorder)" : "var(--whiteTransp)"
														},
														"& .MuiOutlinedInput-root.Mui-focused fieldset": {
															borderColor: "var(--ThemClaire)"
														}
													}}
												/>
													<MuiButton
														variant="contained"
														disableElevation
														disabled={isSubmitting}
														onClick={(event) => {
															stopCellEvent(event);
															handleAddItem(articleId);
														}}
														onMouseDown={stopCellEvent}
														sx={{
															width: 76,
															minWidth: 76,
															height: 30,
															textTransform: "none",
															fontFamily: "poppins",
															fontSize: "12px",
															fontWeight: 500,
															backgroundColor: "#f87269",
															"&:hover": {
																backgroundColor: "#eb6258"
															},
															"&:active": {
																backgroundColor: "#E42417"
															}
														}}
													>
														{isRowAdding ? "Ajout..." : "Ajouter"}
													</MuiButton>
												</div>
											);
										}
								}}
							/>
						</div>
						{addArticleRows.length === 0 && (
							<p className="sales-add-empty">
								Aucun article disponible pour ce ticket.
							</p>
						)}
						<div className="sales-modal-actions">
							<BasicButton
								variant={"outlined"}
								color={"var(--ThemClaire)"}
								colorH={"var(--white)"}
								bgColor={"transparent"}
								bgColorH={"var(--ThemClaire)"}
								bgColorA={"var(--ThemClaire)"}
								brdrColor={"var(--ThemClaire)"}
								brdrColorH={"var(--ThemClaire)"}
								textBtn={"Fermer"}
								width={110}
								padding={"7.7px 0px 9px 0px"}
								onClick={() => setIsAddPopupOpen(false)}
							/>
						</div>
					</div>
				</div>
			)}

			{isEditPopupOpen && editItemTarget && (
				<div className="sales-modal-overlay" onClick={(event) => {
					if (event.target === event.currentTarget && !isSubmitting) {
						setIsEditPopupOpen(false);
						setEditItemTarget(null);
					}
				}}>
					<div className="sales-modal-content" style={{
						backgroundColor: theme === "light" ? "var(--whiteBeMax)" : "var(--noirbe)",
						boxShadow: theme === "light" ? "0 10px 30px rgba(0,0,0,0.18)" : "0 10px 30px rgba(0,0,0,0.4)"
					}}>
						<div className="sales-modal-header">
							<h3>Modifier la quantité</h3>
						</div>
						<p className="sales-modal-line">
							Article : <strong>{editItemTarget.designation}</strong>
						</p>
						<div className="sales-modal-form">
							<TextField
								Width={"100%"}
								Placeholder={"Quantité"}
								value={editQty}
								onChangeValue={setEditQty}
							/>
						</div>
						<div className="sales-modal-actions">
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
								onClick={() => {
									setIsEditPopupOpen(false);
									setEditItemTarget(null);
								}}
							/>
							<BasicButton
								variant={"contained"}
								color={"var(--white)"}
								bgColor={"#f87269"}
								bgColorH={"#eb6258"}
								bgColorA={"#E42417"}
								brdrColor={"#f87269"}
								brdrColorH={"#eb6258"}
								textBtn={isSubmitting ? "Modification..." : "Valider"}
								width={120}
								padding={"7.7px 0px 9px 0px"}
								onClick={handleUpdateItemQty}
							/>
						</div>
					</div>
				</div>
			)}

			{isDeleteItemPopupOpen && deleteItemTarget && (
				<div className="sales-modal-overlay" onClick={(event) => {
					if (event.target === event.currentTarget && !isSubmitting) {
						setIsDeleteItemPopupOpen(false);
						setDeleteItemTarget(null);
					}
				}}>
					<div className="sales-modal-content sales-modal-small" style={{
						backgroundColor: theme === "light" ? "var(--whiteBeMax)" : "var(--noirbe)",
						boxShadow: theme === "light" ? "0 10px 30px rgba(0,0,0,0.18)" : "0 10px 30px rgba(0,0,0,0.4)"
					}}>
						<div className="sales-modal-header">
							<h3>Supprimer l'item</h3>
						</div>
						<p className="sales-modal-line">
							Voulez-vous retirer <strong>{deleteItemTarget.designation}</strong> du ticket ?
						</p>
						<div className="sales-modal-actions">
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
								onClick={() => {
									setIsDeleteItemPopupOpen(false);
									setDeleteItemTarget(null);
								}}
							/>
							<BasicButton
								variant={"contained"}
								color={"var(--white)"}
								bgColor={"#f87269"}
								bgColorH={"#eb6258"}
								bgColorA={"#E42417"}
								brdrColor={"#f87269"}
								brdrColorH={"#eb6258"}
								textBtn={isSubmitting ? "Suppression..." : "Supprimer"}
								width={120}
								padding={"7.7px 0px 9px 0px"}
								onClick={handleDeleteItem}
							/>
						</div>
					</div>
				</div>
			)}

			{isDeleteTicketPopupOpen && (
				<div className="sales-modal-overlay" onClick={(event) => {
					if (event.target === event.currentTarget && !isSubmitting) {
						setIsDeleteTicketPopupOpen(false);
					}
				}}>
					<div className="sales-modal-content sales-modal-small" style={{
						backgroundColor: theme === "light" ? "var(--whiteBeMax)" : "var(--noirbe)",
						boxShadow: theme === "light" ? "0 10px 30px rgba(0,0,0,0.18)" : "0 10px 30px rgba(0,0,0,0.4)"
					}}>
						<div className="sales-modal-header">
							<h3>Supprimer le ticket</h3>
						</div>
						<p className="sales-modal-line">
							Cette action supprimera le ticket et tous ses items.
						</p>
						<div className="sales-modal-actions">
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
								onClick={() => setIsDeleteTicketPopupOpen(false)}
							/>
							<BasicButton
								variant={"contained"}
								color={"var(--white)"}
								bgColor={"#f87269"}
								bgColorH={"#eb6258"}
								bgColorA={"#E42417"}
								brdrColor={"#f87269"}
								brdrColorH={"#eb6258"}
								textBtn={isSubmitting ? "Suppression..." : "Supprimer"}
								width={120}
								padding={"7.7px 0px 9px 0px"}
								onClick={handleDeleteTicket}
							/>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
