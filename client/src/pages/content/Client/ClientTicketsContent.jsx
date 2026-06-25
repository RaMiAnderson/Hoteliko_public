import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import IconButton from "@mui/material/IconButton";
import EditIco from "@mui/icons-material/EditOutlined";
import DeleteIco from "@mui/icons-material/DeleteOutline";

import "./ClientListStyle.css";

import { useTheme } from "../../../context/themeContext";
import { formatNumberWithSpace } from "../../../services/formatNumber.js";
import useRealtimeEvents from "../../../services/useRealtimeEvents.js";
import axios from "axios";

import TableList from "../../../components/TableList/TableListReactif_delBtn.jsx";
import InputSearch from "../../../components/InputSearch/InputSearch.jsx";
import BasicButton from "../../../components/BasicButton/BasicButtons.jsx";
import Loading from "../../../components/Loading/Loading.jsx";

const FALLBACK_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const PAYMENT_TYPE_OPTIONS = [
	{ value: "tout", label: "Tout" },
	{ value: "attente", label: "En attente" },
	{ value: "comptant", label: "Au comptant" }
];

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

const resolvePaymentStatus = (resteValue) => {
	const reste = Number(resteValue ?? 0);
	if (!Number.isFinite(reste) || reste > 0) return "Non Payé";
	return "Payé";
};

export default function ClientTicketsContent() {
	const { theme } = useTheme();
	const API_URL = import.meta.env.VITE_API_URL;
	const navigate = useNavigate();
	const { clientId } = useParams();
	const lastRealtimeSyncRef = useRef(0);
	const hasInitializedRef = useRef(false);

	const clientIdNumber = Number(clientId);

	const [clientData, setClientData] = useState(null);
	const [allClientTickets, setAllClientTickets] = useState([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isTabLoading, setIsTabLoading] = useState(true);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const [paymentType, setPaymentType] = useState("tout");
	const [searchTicketValue, setSearchTicketValue] = useState("");
	const [appliedSearchValue, setAppliedSearchValue] = useState("");

	const [isDeletePopupOpen, setIsDeletePopupOpen] = useState(false);
	const [deleteTicketTarget, setDeleteTicketTarget] = useState(null);

	const loadClientTickets = useCallback(async ({ resetSearch = true, type = paymentType } = {}) => {
		if (!Number.isFinite(clientIdNumber) || clientIdNumber <= 0) {
			toast.error("Client invalide");
			navigate("/admin/clients");
			return;
		}

		try {
			setIsTabLoading(true);

			const [clientsRes, ticketsRes] = await Promise.all([
				axios.get(`${API_URL}/api/clients/all`),
				axios.get(`${API_URL}/api/tickets/all?type=${encodeURIComponent(type)}`)
			]);

			const clients = Array.isArray(clientsRes.data) ? clientsRes.data : [];
			const targetClient = clients.find((clientEntry) => Number(clientEntry.id) === clientIdNumber);
			if (!targetClient) {
				toast.error("Client introuvable");
				navigate("/admin/clients");
				return;
			}

			const allTickets = Array.isArray(ticketsRes.data) ? ticketsRes.data : [];
			const clientTickets = allTickets.filter((ticket) => Number(ticket.client_id) === clientIdNumber);

			setClientData(targetClient);
			setAllClientTickets(clientTickets);
		} catch (err) {
			toast.error("Erreur de chargement des tickets client");
			console.log(err);
		} finally {
			setIsTabLoading(false);
			if (resetSearch) {
				setSearchTicketValue("");
				setAppliedSearchValue("");
			}
		}
	}, [API_URL, clientIdNumber, navigate, paymentType]);

	useEffect(() => {
		const init = async () => {
			if (!hasInitializedRef.current) {
				setIsLoading(true);
			}

			await loadClientTickets({
				resetSearch: hasInitializedRef.current,
				type: paymentType
			});

			if (!hasInitializedRef.current) {
				setIsLoading(false);
				hasInitializedRef.current = true;
			}
		};

		init();
	}, [loadClientTickets, paymentType]);

	useRealtimeEvents(useCallback((event) => {
		if (!event || !["tickets-updated", "clients-updated"].includes(event.type)) return;

		const now = Date.now();
		if (now - lastRealtimeSyncRef.current < 1500) return;
		lastRealtimeSyncRef.current = now;

		loadClientTickets({ resetSearch: false, type: paymentType });
	}, [loadClientTickets, paymentType]));

	useEffect(() => {
		if (isLoading) return undefined;

		const intervalId = setInterval(() => {
			loadClientTickets({ resetSearch: false, type: paymentType });
		}, FALLBACK_REFRESH_INTERVAL_MS);

		return () => clearInterval(intervalId);
	}, [isLoading, loadClientTickets, paymentType]);

	useEffect(() => {
		if (!isDeletePopupOpen) return undefined;

		const handleEscape = (event) => {
			if (event.key === "Escape" && !isSubmitting) {
				setIsDeletePopupOpen(false);
				setDeleteTicketTarget(null);
			}
		};

		document.addEventListener("keydown", handleEscape);
		return () => document.removeEventListener("keydown", handleEscape);
	}, [isDeletePopupOpen, isSubmitting]);

	const filteredTickets = useMemo(() => {
		const cleanedSearch = String(appliedSearchValue ?? "").trim().toLowerCase();
		if (!cleanedSearch) return allClientTickets;

		return allClientTickets.filter((ticket) => {
			const searchableValues = [
				formatTicketNumber(ticket.id),
				formatTicketDate(ticket.date_ticket),
				formatPaymentType(ticket.type_paiement),
				ticket.table_num,
				ticket.servi_par
			];

			return searchableValues.some((value) =>
				String(value ?? "").toLowerCase().includes(cleanedSearch)
			);
		});
	}, [allClientTickets, appliedSearchValue]);

	const tableRows = useMemo(() => {
		return filteredTickets.map((ticket) => ({
			ID: ticket.id,
			ticket: formatTicketNumber(ticket.id),
			date: formatTicketDate(ticket.date_ticket),
			total: `${formatNumberWithSpace(ticket.total_ticket)} Ar`,
			type: formatPaymentType(ticket.type_paiement),
			table: String(ticket.table_num ?? "-"),
			serveur: String(ticket.servi_par ?? "-"),
			statut: resolvePaymentStatus(ticket.reste),
			reste: Number(ticket.reste) || 0
		}));
	}, [filteredTickets]);

	const optionsInputSearch = useMemo(() => {
		const options = [];

		allClientTickets.forEach((ticket) => {
			options.push(formatTicketNumber(ticket.id));
			if (ticket.table_num) options.push(String(ticket.table_num));
			if (ticket.servi_par) options.push(String(ticket.servi_par));
		});

		return Array.from(new Set(options));
	}, [allClientTickets]);

	const clientDisplayName = useMemo(() => {
		if (!clientData) return "Client";
		const nom = String(clientData.nom ?? "").trim();
		const prenom = String(clientData.prenom ?? "").trim();
		return `${nom} ${prenom}`.trim() || "Client";
	}, [clientData]);

	const createRow = (row, index) => ({
		id: row.ID || index,
		ticket: row.ticket,
		date: row.date,
		total: row.total,
		type: row.type,
		table: row.table,
		serveur: row.serveur,
		statut: row.statut,
		reste: row.reste
	});

	const openTicketDetail = useCallback((ticketId) => {
		const numericId = Number(ticketId);
		if (!Number.isFinite(numericId) || numericId <= 0) {
			toast.error("Ticket introuvable");
			return;
		}

		navigate(`/admin/ventes/${numericId}`, {
			state: {
				returnTo: `/admin/clients/${clientIdNumber}`
			}
		});
	}, [clientIdNumber, navigate]);

	const applySearchValue = useCallback((searchValue = searchTicketValue) => {
		setAppliedSearchValue(String(searchValue ?? "").trim());
	}, [searchTicketValue]);

	const handleSearchKeyDown = (event) => {
		if (event.key === "Enter") {
			event.preventDefault();
			applySearchValue(event.target.value);
		}
	};

	const handleRefresh = async () => {
		await loadClientTickets({ type: paymentType });
	};

	const openDeletePopup = (row) => {
		const numericId = Number(row?.id);
		if (!Number.isFinite(numericId) || numericId <= 0) {
			toast.error("Ticket introuvable");
			return;
		}

		setDeleteTicketTarget({
			id: numericId,
			ticket: String(row.ticket ?? formatTicketNumber(numericId))
		});
		setIsDeletePopupOpen(true);
	};

	const closeDeletePopup = (force = false) => {
		if (isSubmitting && !force) return;
		setIsDeletePopupOpen(false);
		setDeleteTicketTarget(null);
	};

	const handleConfirmDeleteTicket = async () => {
		const numericId = Number(deleteTicketTarget?.id);
		if (!Number.isFinite(numericId) || numericId <= 0 || isSubmitting) return;

		try {
			setIsSubmitting(true);
			const res = await axios.delete(`${API_URL}/api/tickets/${numericId}`);
			if (res.status === 200) {
				toast.success("Ticket supprimé");
				closeDeletePopup(true);
				await loadClientTickets({ resetSearch: false, type: paymentType });
			}
		} catch (err) {
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
		<div className={`clientPage client-ticket-page ${isDeletePopupOpen ? "popup-open" : ""}`}>
			<div className="rightPart client-main-content">
				<div className="findSection">
					<h4 className="client-ticket-title">
						Tickets de <span>{clientDisplayName}</span>
					</h4>
					<section style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
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
							onClick={() => navigate("/admin/clients")}
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
						<div className="client-ticket-filter-group">
							<label htmlFor="client-ticket-type-filter" className="client-ticket-filter-label">Type</label>
							<select
								id="client-ticket-type-filter"
								className={`client-ticket-filter-select ${theme === "light" ? "light" : "dark"}`}
								value={paymentType}
								onChange={(event) => setPaymentType(event.target.value)}
							>
								{PAYMENT_TYPE_OPTIONS.map((option) => (
									<option key={option.value} value={option.value}>{option.label}</option>
								))}
							</select>
						</div>
						<InputSearch
							value={searchTicketValue}
							onChangeValue={setSearchTicketValue}
							options={optionsInputSearch}
							label={"Ticket / Table / Serveur"}
							onKeyDown={handleSearchKeyDown}
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
							width={100}
							padding={"7.7px 0px 9px 0px"}
							onClick={applySearchValue}
						/>
					</section>
				</div>

				<div className="tableAff" style={{ overflow: "hidden", marginTop: "15px" }}>
					<TableList
						TabLisHead={["Ticket", "Date", "Total", "Type", "Table", "Serveur", "Statut"]}
						onRowClick={openTicketDetail}
						TabListBody={tableRows}
						createRow={createRow}
						isLoading={isTabLoading}
						columnFlexOverrides={{
							ticket: 0.95
						}}
						columnMinWidthOverrides={{
							ticket: 130
						}}
						actionColumn={{
							headerName: "Action",
							field: "action",
							flex: 0.95,
							minWidth: 132,
							renderCell: (params) => (
								<div className="client-row-actions">
									<IconButton
										size="small"
										onClick={(event) => {
											event.stopPropagation();
											openTicketDetail(params.row.id);
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
											openDeletePopup(params.row);
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
							<h3>Supprimer le ticket</h3>
						</div>

						<p className="client-delete-text">
							Cette action supprimera le ticket <strong>{deleteTicketTarget?.ticket || ""}</strong> et ses items.
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
								textBtn={isSubmitting ? "Suppression..." : "Supprimer"}
								width={110}
								padding={"7.7px 0px 9px 0px"}
								onClick={handleConfirmDeleteTicket}
							/>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
