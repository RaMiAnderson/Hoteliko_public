import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import "./VentesListStyle.css";

import { useTheme } from '../../../context/themeContext';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { formatNumberWithSpace } from '../../../services/formatNumber.js';
import useRealtimeEvents from '../../../services/useRealtimeEvents.js';
import Button from '@mui/material/Button';

import TableList from "../../../components/TableList/TableListReactif_delBtn.jsx";
import InputSearch from "../../../components/InputSearch/InputSearch.jsx";
import BasicButton from "../../../components/BasicButton/BasicButtons.jsx";
import Loading from "../../../components/Loading/Loading.jsx";
import TextField from "../../../components/Textfield/TextField.jsx";

const FALLBACK_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const PAYMENT_TYPE_OPTIONS = [
	{ value: "attente", label: "En attente" },
	{ value: "comptant", label: "Au comptant" },
	{ value: "tout", label: "Tout" }
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

export default function VentesListContent() {
	const { theme } = useTheme();
	const API_URL = import.meta.env.VITE_API_URL;
	const navigate = useNavigate();
	const lastRealtimeSyncRef = useRef(0);
	const hasInitializedRef = useRef(false);

	const [allTickets, setAllTickets] = useState([]);
	const [TabDataBody, setTabDataBody] = useState([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isTabLoading, setIsTabLoading] = useState(true);
	const [paymentType, setPaymentType] = useState("attente");
	const [searchTicketValue, setSearchTicketValue] = useState("");
	const [appliedSearchValue, setAppliedSearchValue] = useState("");
	const [payingTicketId, setPayingTicketId] = useState(null);
	const [isPayPopupOpen, setIsPayPopupOpen] = useState(false);
	const [payTarget, setPayTarget] = useState(null);
	const [montantRecuInput, setMontantRecuInput] = useState("");

	const reinit_AllTickets = useCallback(async ({ resetSearch = true, type = paymentType } = {}) => {
		try {
			setIsTabLoading(true);
			const resInit = await axios.get(`${API_URL}/api/tickets/all?type=${encodeURIComponent(type)}`);

			if (resInit.status === 200) {
				setAllTickets(resInit.data);
			} else {
				toast.error("Erreur d'initialisation des ventes");
			}
		} catch (err) {
			toast.error("Erreur d'initialisation des ventes");
			console.log(err);
		} finally {
			setIsTabLoading(false);
			if (resetSearch) {
				setSearchTicketValue("");
				setAppliedSearchValue("");
			}
		}
	}, [API_URL, paymentType]);

	useEffect(() => {
		const loadTickets = async () => {
			if (!hasInitializedRef.current) {
				setIsLoading(true);
			}

			await reinit_AllTickets({
				resetSearch: hasInitializedRef.current,
				type: paymentType
			});

			if (!hasInitializedRef.current) {
				setIsLoading(false);
				hasInitializedRef.current = true;
			}
		};

		loadTickets();
	}, [paymentType, reinit_AllTickets]);

	const filteredTickets = useMemo(() => {
		const cleanedSearch = String(appliedSearchValue ?? "").trim().toLowerCase();
		if (!cleanedSearch) return allTickets;

		return allTickets.filter((ticket) => {
			const searchableValues = [
				formatTicketNumber(ticket.id),
				ticket.client_nom,
				ticket.table_num,
				ticket.servi_par,
				formatTicketDate(ticket.date_ticket),
				formatPaymentType(ticket.type_paiement)
			];

			return searchableValues.some((value) =>
				String(value ?? "").toLowerCase().includes(cleanedSearch)
			);
		});
	}, [allTickets, appliedSearchValue]);

	useEffect(() => {
		setTabDataBody(
			filteredTickets.map((ticket) => ({
				ID: ticket.id,
				ticket: formatTicketNumber(ticket.id),
				client: String(ticket.client_nom ?? "-"),
				date: formatTicketDate(ticket.date_ticket),
				total: `${formatNumberWithSpace(ticket.total_ticket)} Ar`,
				type: formatPaymentType(ticket.type_paiement),
				table: String(ticket.table_num ?? "-"),
				serveur: String(ticket.servi_par ?? "-"),
				statut: resolvePaymentStatus(ticket.reste),
				reste: Number(ticket.reste) || 0
			}))
		);
	}, [filteredTickets]);

	useRealtimeEvents(useCallback((event) => {
		if (!event || !["tickets-updated", "stock-updated"].includes(event.type)) return;

		const now = Date.now();
		if (now - lastRealtimeSyncRef.current < 1500) return;
		lastRealtimeSyncRef.current = now;

		reinit_AllTickets({ resetSearch: false, type: paymentType });
	}, [paymentType, reinit_AllTickets]));

	useEffect(() => {
		if (isLoading) return undefined;

		const intervalId = setInterval(() => {
			reinit_AllTickets({ resetSearch: false, type: paymentType });
		}, FALLBACK_REFRESH_INTERVAL_MS);

		return () => clearInterval(intervalId);
	}, [isLoading, paymentType, reinit_AllTickets]);

	const optionsInputSearch = useMemo(() => {
		const options = [];

		allTickets.forEach((ticket) => {
			options.push(formatTicketNumber(ticket.id));
			if (ticket.client_nom) options.push(ticket.client_nom);
		});

		return Array.from(new Set(options));
	}, [allTickets]);

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
		await reinit_AllTickets({ type: paymentType });
	};

	const handlePaymentTypeChange = (event) => {
		setPaymentType(event.target.value);
	};

	const closePayPopup = (force = false) => {
		if (payingTicketId && !force) return;
		setIsPayPopupOpen(false);
		setPayTarget(null);
		setMontantRecuInput("");
	};

	const openPayPopup = (row) => {
		if (!row) return;

		const target = {
			id: Number(row.id),
			ticket: String(row.ticket ?? formatTicketNumber(row.id)),
			client: String(row.client ?? "-"),
			reste: Math.max(0, Number(row.reste) || 0)
		};

		if (!Number.isFinite(target.id) || target.id <= 0) {
			toast.error("Ticket introuvable");
			return;
		}

		setPayTarget(target);
		setMontantRecuInput("");
		setIsPayPopupOpen(true);
	};

	useEffect(() => {
		if (!isPayPopupOpen) return undefined;

		const handleEscape = (event) => {
			if (event.key === "Escape") {
				closePayPopup();
			}
		};

		document.addEventListener("keydown", handleEscape);
		return () => document.removeEventListener("keydown", handleEscape);
	}, [isPayPopupOpen, payingTicketId]);

	const parseMontantInput = (value) => {
		const cleaned = String(value ?? "").trim().replace(/\s/g, "").replace(",", ".");
		if (!cleaned) return { isValid: false, value: 0 };

		const parsed = Number(cleaned);
		if (!Number.isFinite(parsed) || parsed < 0) return { isValid: false, value: 0 };

		return { isValid: true, value: parsed };
	};

	const payTargetReste = Math.max(0, Number(payTarget?.reste) || 0);
	const parsedMontantRecu = parseMontantInput(montantRecuInput);
	const montantRecuValue = parsedMontantRecu.isValid ? parsedMontantRecu.value : 0;
	const montantARendre = Math.max(0, montantRecuValue - payTargetReste);
	const resteApresPaiement = Math.max(0, payTargetReste - montantRecuValue);

	const handleConfirmPayTicket = async () => {
		const numericId = Number(payTarget?.id);
		if (!Number.isFinite(numericId) || numericId <= 0 || payingTicketId) return;
		if (!parsedMontantRecu.isValid || montantRecuValue <= 0) {
			toast.error("Montant reçu invalide");
			return;
		}

		try {
			setPayingTicketId(numericId);
			const response = await axios.patch(`${API_URL}/api/tickets/${numericId}/pay`, {
				montant_recu: montantRecuValue
			});
			if (response.status === 200) {
				toast.success(response.data?.message || "Paiement enregistré");
				closePayPopup(true);
				await reinit_AllTickets({ resetSearch: false, type: paymentType });
			} else {
				toast.error("Paiement impossible");
			}
		} catch (err) {
			toast.error("Erreur de paiement");
			console.log(err);
		} finally {
			setPayingTicketId(null);
		}
	};

	const createRow = (row, index) => ({
		id: row.ID || index,
		ticket: row.ticket,
		client: row.client,
		date: row.date,
		total: row.total,
		type: row.type,
		table: row.table,
		serveur: row.serveur,
		statut: row.statut,
		reste: row.reste
	});

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
		<div className={`salesPage ${isPayPopupOpen ? "popup-open" : ""}`}>
			<div className="rightPart sales-main-content">
				<div className="findSection">
					<section style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", justifyContent: "flex-end" }}>
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
							padding={"8px 0px"}
							onClick={handleRefresh}
						/>

						<div className="sales-filter-group">
							<label htmlFor="ticket-type-filter" className="sales-filter-label">Type</label>
							<select
								id="ticket-type-filter"
								className={`sales-filter-select ${theme === "light" ? "light" : "dark"}`}
								value={paymentType}
								onChange={handlePaymentTypeChange}
							>
								{PAYMENT_TYPE_OPTIONS.map((option) => (
									<option key={option.value} value={option.value}>
										{option.label}
									</option>
								))}
							</select>
						</div>

						<InputSearch
							value={searchTicketValue}
							onChangeValue={setSearchTicketValue}
							options={optionsInputSearch}
							label={"Ticket / Client"}
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
							padding={"8px 0px"}
							onClick={applySearchValue}
						/>
					</section>
				</div>

				<div className="tableAff" style={{ overflow: "hidden", marginTop: "15px" }}>
					<TableList
						TabLisHead={["Ticket", "Client", "Date", "Total", "Type", "Table", "Serveur", "Statut"]}
						onRowClick={(id) => navigate(`/admin/ventes/${id}`)}
						TabListBody={TabDataBody}
						createRow={createRow}
						isLoading={isTabLoading}
						columnFlexOverrides={{
							ticket: 0.95,
							client: 1.75
						}}
						columnMinWidthOverrides={{
							ticket: 130,
							client: 230
						}}
						actionColumn={{
							headerName: "Action",
							field: "action",
							flex: 0.9,
							minWidth: 125,
							renderCell: (params) => {
								const isUnpaid = params.row.statut === "Non Payé";
								if (!isUnpaid) return null;

								const isSubmitting = payingTicketId === params.row.id;
								return (
									<Button
										size="small"
										variant="contained"
										onClick={(event) => {
											event.stopPropagation();
											openPayPopup(params.row);
										}}
										disabled={Boolean(payingTicketId) || isPayPopupOpen}
										sx={{
											textTransform: "none",
											fontFamily: "poppins",
											fontSize: "12px",
											fontWeight: 500,
											minWidth: 76,
											height: 30,
											backgroundColor: "var(--ThemClaire)",
											"&:hover": {
												backgroundColor: "var(--ThemDur)"
											}
										}}
									>
										{isSubmitting ? "..." : "Payer"}
									</Button>
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
		</div>
	);
}
