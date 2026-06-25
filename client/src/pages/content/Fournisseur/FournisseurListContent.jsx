import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import './FournisseurListStyle.css';

import { useTheme } from '../../../context/themeContext';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import EditIco from '@mui/icons-material/EditOutlined';
import DeleteIco from '@mui/icons-material/DeleteOutline';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import useRealtimeEvents from '../../../services/useRealtimeEvents';

import TableList from '../../../components/TableList/TableListReactif_delBtn.jsx';
import InputSearch from '../../../components/InputSearch/InputSearch.jsx';
import BasicButton from '../../../components/BasicButton/BasicButtons.jsx';
import TextField from '../../../components/Textfield/TextField.jsx';
import Loading from '../../../components/Loading/Loading.jsx';

const ROOM_STATUS_LABELS = {
	libre: 'Libre',
	reservee: 'Reservee',
	occupee: 'Occupee',
	maintenance: 'Maintenance'
};

const OCCUPATION_TYPE_LABELS = {
	reservation: 'Reservation',
	occupation: 'Occupation'
};

const OCCUPATION_STATUS_LABELS = {
	active: 'Active',
	terminee: 'Terminee',
	annulee: 'Annulee'
};

const OCCUPANCY_MODE_LABELS = {
	reservation: 'Reservation',
	occupation: 'Occupation'
};

const STAY_TYPE_LABELS = {
	nuit: 'Nuit',
	passage: 'Passage',
	journee: 'Journée'
};

const DEFAULT_ROOM_CONDITION = {
	checkin_time: '13:00',
	checkout_time: '09:00',
	day_checkin_time: '08:00',
	day_checkout_time: '18:00',
	cin_required_reservation: true,
	cin_required_occupation: true,
	deposit_percent: 0,
	hourly_prices: {},
	day_prices: {},
	nightly_prices: {}
};


const formatNumberWithSpace = (value) => {
	const numeric = Number(value) || 0;
	return numeric.toLocaleString('fr-FR');
};

const normalizeStatus = (status) => {
	const key = String(status ?? '').toLowerCase();
	if (Object.prototype.hasOwnProperty.call(ROOM_STATUS_LABELS, key)) return key;
	return 'libre';
};

const normalizeOccupationType = (type) => {
	const key = String(type ?? '').toLowerCase();
	if (Object.prototype.hasOwnProperty.call(OCCUPATION_TYPE_LABELS, key)) return key;
	return '';
};

const normalizeOccupationStatus = (status) => {
	const key = String(status ?? '').toLowerCase();
	if (Object.prototype.hasOwnProperty.call(OCCUPATION_STATUS_LABELS, key)) return key;
	return '';
};

const normalizeStayType = (value) => {
	const key = String(value ?? '').toLowerCase();
	if (Object.prototype.hasOwnProperty.call(STAY_TYPE_LABELS, key)) return key;
	return 'nuit';
};

const normalizeRoomTypeKey = (value) => String(value ?? '').trim().toLowerCase();

const formatDateTime = (value) => {
	if (!value) return '-';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return '-';
	return date.toLocaleString('fr-FR', {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit'
	});
};

const parseTimeParts = (value) => {
	const raw = String(value ?? '').trim();
	if (!raw) return null;
	const match = raw.match(/^(\d{1,2}):(\d{2})$/);
	if (!match) return null;
	const hours = Number(match[1]);
	const minutes = Number(match[2]);
	if (!Number.isInteger(hours) || hours < 0 || hours > 23) return null;
	if (!Number.isInteger(minutes) || minutes < 0 || minutes > 59) return null;
	return { hours, minutes };
};

const resolveDateValue = (value) => {
	if (!value) return null;
	if (value instanceof Date) return value;
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return null;
	return date;
};

const alignDateTimeToCondition = (value, timeValue) => {
	const date = resolveDateValue(value);
	if (!date) return null;
	const parsed = parseTimeParts(timeValue);
	if (!parsed) return date;
	const aligned = new Date(date);
	aligned.setHours(parsed.hours, parsed.minutes, 0, 0);
	return aligned;
};

const formatDateTimeDisplay = (value) => {
	const date = resolveDateValue(value);
	if (!date) return '';
	const pad = (num) => String(num).padStart(2, '0');
	const dd = pad(date.getDate());
	const mm = pad(date.getMonth() + 1);
	const yyyy = date.getFullYear();
	const hh = pad(date.getHours());
	const min = pad(date.getMinutes());
	return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
};

const formatDateDisplay = (value) => {
	const date = resolveDateValue(value);
	if (!date) return '';
	const pad = (num) => String(num).padStart(2, '0');
	const dd = pad(date.getDate());
	const mm = pad(date.getMonth() + 1);
	const yyyy = date.getFullYear();
	return `${dd}/${mm}/${yyyy}`;
};

const toDateOnly = (value) => {
	const date = resolveDateValue(value);
	if (!date) return null;
	return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const isDateInRangeInclusive = (target, start, end) => {
	if (!target || !start) return false;
	const targetDay = toDateOnly(target);
	const startDay = toDateOnly(start);
	const endDay = toDateOnly(end || start);
	if (!targetDay || !startDay || !endDay) return false;
	if (endDay < startDay) return false;
	return targetDay >= startDay && targetDay <= endDay;
};

const getMonthStart = (value) => {
	const date = resolveDateValue(value) || new Date();
	return new Date(date.getFullYear(), date.getMonth(), 1);
};

const MONTH_LABELS = [
	'Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin',
	'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre'
];

const getDaysInMonth = (year, month) => {
	if (!year || !month) return 31;
	return new Date(year, month, 0).getDate();
};

const calculateNights = (start, end) => {
	if (!start || !end) return 0;
	const diffMs = end.getTime() - start.getTime();
	if (diffMs <= 0) return 0;
	return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
};

const calculateHours = (start, end) => {
	if (!start || !end) return 0;
	const diffMs = end.getTime() - start.getTime();
	if (diffMs <= 0) return 0;
	return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60)));
};

const calculateDays = (start, end) => {
	if (!start || !end) return 0;
	const diffMs = end.getTime() - start.getTime();
	if (diffMs <= 0) return 0;
	return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
};

const calculateDaysInclusive = (start, end) => {
	if (!start || !end) return 0;
	const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
	const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
	const diffDays = Math.floor((endUtc - startUtc) / (1000 * 60 * 60 * 24));
	if (diffDays < 0) return 0;
	return diffDays + 1;
};

const isOngoingMultiNightStay = (alignedStart, plannedEndRaw, checkoutTime, now) => {
	if (!alignedStart || !plannedEndRaw || !checkoutTime || !now) return false;
	const plannedEnd = resolveDateValue(plannedEndRaw);
	if (!plannedEnd || plannedEnd <= now) return false;
	const plannedAlignedEnd = alignDateTimeToCondition(plannedEnd, checkoutTime);
	if (!plannedAlignedEnd) return false;
	const plannedNights = calculateNights(alignedStart, plannedAlignedEnd);
	return plannedNights > 1;
};

const computeReleaseSummary = (targetRoom, roomCondition) => {
	if (!targetRoom) {
		return { nights: 0, hours: 0, total: 0, reste: 0 };
	}
	const stayType = normalizeStayType(targetRoom.type_sejour);
	const occupationType = normalizeOccupationType(targetRoom.occupationType ?? targetRoom.occupation_type ?? targetRoom.occupation);
	const isReservation = occupationType === 'reservation';
	const startRaw = resolveDateValue(targetRoom.raw_date_debut) || new Date();
	const now = new Date();
	let nights = 0;
	let days = 0;
	let hours = 0;
	let computedTotal = 0;

	if (stayType === 'passage') {
		hours = calculateHours(startRaw, now);
		const priceHour = Number(targetRoom.prix_heure) || 0;
		computedTotal = hours > 0 && priceHour > 0 ? Number((hours * priceHour).toFixed(2)) : 0;
	} else if (stayType === 'journee') {
		const journeeExtras = calculateJourneeExtras(startRaw, now, roomCondition.day_checkin_time, roomCondition.day_checkout_time);
		days = journeeExtras.dayCount;
		const priceDay = Number(targetRoom.prix_journee) || 0;
		const extraHoursTotal = journeeExtras.extraHoursTotal;
		const baseTotal = days > 0 && priceDay > 0 ? Number((days * priceDay).toFixed(2)) : 0;
		const extraTotal = extraHoursTotal > 0 && Number(targetRoom.prix_heure) > 0
			? Number((extraHoursTotal * Number(targetRoom.prix_heure)).toFixed(2))
			: 0;
		computedTotal = journeeExtras.isTimeValid
			? Number((baseTotal + extraTotal).toFixed(2))
			: baseTotal;
	} else {
		const alignedStart = alignDateTimeToCondition(startRaw, roomCondition.checkin_time);
		let end = alignDateTimeToCondition(now, roomCondition.checkout_time);
		if (alignedStart && end && end <= alignedStart) {
			end = new Date(end);
			end.setDate(end.getDate() + 1);
		}
		nights = calculateNights(alignedStart, end);
		const priceNight = Number(targetRoom.prix_nuit) || 0;
		const earlyHours = alignedStart && startRaw < alignedStart ? calculateHours(startRaw, alignedStart) : 0;
		const earlyTotal = earlyHours > 0 && Number(targetRoom.prix_heure) > 0
			? Number((earlyHours * Number(targetRoom.prix_heure)).toFixed(2))
			: 0;
		const skipLateHours = isOngoingMultiNightStay(
			alignedStart,
			targetRoom.raw_date_fin_prevue,
			roomCondition.checkout_time,
			now
		);
		const lateHours = !skipLateHours && end && now > end ? calculateHours(end, now) : 0;
		const lateTotal = lateHours > 0 && Number(targetRoom.prix_heure) > 0
			? Number((lateHours * Number(targetRoom.prix_heure)).toFixed(2))
			: 0;
		const baseTotal = nights > 0 && priceNight > 0 ? Number((nights * priceNight).toFixed(2)) : 0;
		computedTotal = Number((baseTotal + earlyTotal + lateTotal).toFixed(2));
	}

	const total = isReservation
		? (computedTotal || Number(targetRoom.montant_total) || 0)
		: (Number(targetRoom.montant_total) || computedTotal);
	const acompte = Number(targetRoom.montant_acompte) || 0;
	const reste = Math.max(0, total - acompte);
	return { nights, hours, total, reste };
};

const getMinutesFromDate = (value) => {
	const date = resolveDateValue(value);
	if (!date) return null;
	return (date.getHours() * 60) + date.getMinutes();
};

const getMinutesFromTimeValue = (value) => {
	const parsed = parseTimeParts(value);
	if (!parsed) return null;
	return (parsed.hours * 60) + parsed.minutes;
};

const calculateJourneeExtras = (start, end, dayCheckin, dayCheckout) => {
	const dayCount = calculateDaysInclusive(start, end);
	const startMinutes = getMinutesFromDate(start);
	const endMinutes = getMinutesFromDate(end);
	const dayStartMinutes = getMinutesFromTimeValue(dayCheckin);
	const dayEndMinutes = getMinutesFromTimeValue(dayCheckout);

	const isTimeValid = dayCount > 0
		&& Number.isFinite(startMinutes)
		&& Number.isFinite(endMinutes)
		&& Number.isFinite(dayStartMinutes)
		&& Number.isFinite(dayEndMinutes)
		&& startMinutes < endMinutes
		&& endMinutes > dayStartMinutes
		&& startMinutes < dayEndMinutes;

	if (!isTimeValid) {
		return {
			dayCount,
			earlyHoursPerDay: 0,
			lateHoursPerDay: 0,
			extraHoursPerDay: 0,
			extraHoursTotal: 0,
			isTimeValid
		};
	}

	const earlyMinutes = Math.max(0, dayStartMinutes - startMinutes);
	const lateMinutes = Math.max(0, endMinutes - dayEndMinutes);
	const earlyHoursPerDay = earlyMinutes > 0 ? Math.ceil(earlyMinutes / 60) : 0;
	const lateHoursPerDay = lateMinutes > 0 ? Math.ceil(lateMinutes / 60) : 0;
	const extraHoursPerDay = earlyHoursPerDay + lateHoursPerDay;
	const extraHoursTotal = extraHoursPerDay * dayCount;

	return {
		dayCount,
		earlyHoursPerDay,
		lateHoursPerDay,
		extraHoursPerDay,
		extraHoursTotal,
		isTimeValid
	};
};

const isSameCalendarDay = (left, right) => {
	if (!left || !right) return false;
	return left.getFullYear() === right.getFullYear()
		&& left.getMonth() === right.getMonth()
		&& left.getDate() === right.getDate();
};

const parseAmountInput = (value) => {
	const cleaned = String(value ?? '').trim().replace(/\s/g, '').replace(',', '.');
	if (!cleaned) return { isValid: false, value: 0 };
	const parsed = Number(cleaned);
	if (!Number.isFinite(parsed) || parsed < 0) return { isValid: false, value: 0 };
	return { isValid: true, value: parsed };
};

const parseOptionalAmountInput = (value) => {
	const cleaned = String(value ?? '').trim();
	if (!cleaned) return { isValid: true, value: 0 };
	return parseAmountInput(cleaned);
};

const calculateTotalReceived = (entry) => {
	if (!entry) return 0;
	const statusKey = normalizeOccupationStatus(entry.statut);
	if (statusKey === 'annulee') {
		const acompte = Number(entry.montant_acompte) || 0;
		const solde = Number(entry.montant_solde) || 0;
		return acompte + solde;
	}

	const hasPaymentInfo = entry.montant_acompte !== undefined && entry.montant_acompte !== null
		|| entry.montant_solde !== undefined && entry.montant_solde !== null;
	if (hasPaymentInfo) {
		const acompte = Number(entry.montant_acompte) || 0;
		const solde = Number(entry.montant_solde) || 0;
		return acompte + solde;
	}

	const montantTotal = Number(entry.montant_total);
	if (Number.isFinite(montantTotal) && montantTotal > 0) {
		return montantTotal;
	}

	const start = new Date(entry.date_debut);
	if (Number.isNaN(start.getTime())) return 0;

	const endRaw = entry.date_fin_reelle || entry.date_fin_prevue;
	if (!endRaw) return 0;
	const end = new Date(endRaw);
	if (Number.isNaN(end.getTime())) return 0;

	const diffMs = end.getTime() - start.getTime();
	if (diffMs <= 0) return 0;

	const stayType = normalizeStayType(entry.type_sejour);
	if (stayType === 'passage') {
		const hours = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60)));
		const price = Number(entry.prix_heure) || 0;
		if (!Number.isFinite(price) || price <= 0) return 0;
		return hours * price;
	}
	if (stayType === 'journee') {
		const days = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
		const price = Number(entry.prix_journee) || 0;
		if (!Number.isFinite(price) || price <= 0) return 0;
		return days * price;
	}

	const nights = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
	const price = Number(entry.prix_nuit) || 0;
	if (!Number.isFinite(price) || price <= 0) return 0;

	return nights * price;
};

const toDateTimeLocal = (value) => {
	if (!value) return '';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return '';
	const pad = (num) => String(num).padStart(2, '0');
	const yyyy = date.getFullYear();
	const mm = pad(date.getMonth() + 1);
	const dd = pad(date.getDate());
	const hh = pad(date.getHours());
	const min = pad(date.getMinutes());
	return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
};

export default function FournisseurListContent() {
	const { theme } = useTheme();
	const API_URL = import.meta.env.VITE_API_URL;
	const [searchParams, setSearchParams] = useSearchParams();
	const isHistoryView = searchParams.get("view") === "history";
	const startDateParam = searchParams.get("startDate");
	const endDateParam = searchParams.get("endDate");

	const [allRooms, setAllRooms] = useState([]);
	const [allClients, setAllClients] = useState([]);
	const [searchRoomValue, setSearchRoomValue] = useState('');
	const [appliedSearchValue, setAppliedSearchValue] = useState('');
	const [isLoading, setIsLoading] = useState(true);
	const [isTabLoading, setIsTabLoading] = useState(true);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [historyRecords, setHistoryRecords] = useState([]);
	const [isHistoryLoading, setIsHistoryLoading] = useState(false);
	const [historySearchValue, setHistorySearchValue] = useState('');
	const [appliedHistorySearchValue, setAppliedHistorySearchValue] = useState('');
	const [historyStatusFilter, setHistoryStatusFilter] = useState('tout');
	const [isHistoryDetailOpen, setIsHistoryDetailOpen] = useState(false);
	const [selectedHistoryId, setSelectedHistoryId] = useState(null);
	const [isActiveHistoryDetailOpen, setIsActiveHistoryDetailOpen] = useState(false);
	const [selectedActiveHistoryId, setSelectedActiveHistoryId] = useState(null);
	const [activeHistoryRoom, setActiveHistoryRoom] = useState(null);
	const [activeHistoryRecords, setActiveHistoryRecords] = useState([]);
	const [isActiveHistoryLoading, setIsActiveHistoryLoading] = useState(false);
	const [activeHistorySearchValue, setActiveHistorySearchValue] = useState('');
	const [activeHistoryOccupationFilter, setActiveHistoryOccupationFilter] = useState('tout');
	const [activeHistoryDate, setActiveHistoryDate] = useState(() => new Date());
	const [activeHistoryMonth, setActiveHistoryMonth] = useState(() => new Date());
	const [activeCalendarView, setActiveCalendarView] = useState('day');
	const [activeYearPageStart, setActiveYearPageStart] = useState(() => {
		const year = new Date().getFullYear();
		return year - (year % 12);
	});
	const roomRefreshTimeoutRef = useRef(null);
	const expiredReservationRef = useRef(new Set());
	const availabilityRequestRef = useRef(0);
	const availabilityDebounceRef = useRef(null);
	
	const [roomCondition, setRoomCondition] = useState(DEFAULT_ROOM_CONDITION);
	const [conditionForm, setConditionForm] = useState(DEFAULT_ROOM_CONDITION);
	const [isConditionPopupOpen, setIsConditionPopupOpen] = useState(false);
	const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
	const [timePickerTarget, setTimePickerTarget] = useState(null);
	const [timePickerHour, setTimePickerHour] = useState('00');
	const [timePickerMinute, setTimePickerMinute] = useState('00');
	const [isDateTimePickerOpen, setIsDateTimePickerOpen] = useState(false);
	const [dateTimePickerTarget, setDateTimePickerTarget] = useState(null);
	const [dateTimePickerDay, setDateTimePickerDay] = useState('01');
	const [dateTimePickerMonth, setDateTimePickerMonth] = useState('01');
	const [dateTimePickerYear, setDateTimePickerYear] = useState(String(new Date().getFullYear()));
	const [dateTimePickerHour, setDateTimePickerHour] = useState('00');
	const [dateTimePickerMinute, setDateTimePickerMinute] = useState('00');
	const [hourlyTypeSelection, setHourlyTypeSelection] = useState('');
	const [dayTypeSelection, setDayTypeSelection] = useState('');
	const [nightlyTypeSelection, setNightlyTypeSelection] = useState('');


	const [isRoomPopupOpen, setIsRoomPopupOpen] = useState(false);
	const [roomPopupMode, setRoomPopupMode] = useState('create');
	const [editingRoomId, setEditingRoomId] = useState(null);
	const [roomNumero, setRoomNumero] = useState('');
	const [roomType, setRoomType] = useState('Standard');
	const [roomCapacite, setRoomCapacite] = useState('1');
	const [roomPrixNuit, setRoomPrixNuit] = useState('0');
	const [roomDescription, setRoomDescription] = useState('');

	const [isDeletePopupOpen, setIsDeletePopupOpen] = useState(false);
	const [deleteRoomTarget, setDeleteRoomTarget] = useState(null);

	const [isOccupancyPopupOpen, setIsOccupancyPopupOpen] = useState(false);
	const [isOccupancyConfirmOpen, setIsOccupancyConfirmOpen] = useState(false);
	const [occupancyTargetRoom, setOccupancyTargetRoom] = useState(null);
	const [occupancyMode, setOccupancyMode] = useState('reservation');
	const [occupancyStayType, setOccupancyStayType] = useState('nuit');
	const [occupancyClientId, setOccupancyClientId] = useState('');
	const [occupancyName, setOccupancyName] = useState('');
	const [occupancyContact, setOccupancyContact] = useState('');
	const [occupancyCin, setOccupancyCin] = useState('');
	const [occupancyStart, setOccupancyStart] = useState('');
	const [occupancyEnd, setOccupancyEnd] = useState('');
	const [occupancyNote, setOccupancyNote] = useState('');
	const [lockOccupancyMode, setLockOccupancyMode] = useState(false);
	const [isDepositPopupOpen, setIsDepositPopupOpen] = useState(false);
	const [depositInput, setDepositInput] = useState("");
	const [availabilityStatus, setAvailabilityStatus] = useState('idle');
	const [availabilityConflict, setAvailabilityConflict] = useState(null);
	const [availabilityMessage, setAvailabilityMessage] = useState('');


	const [isReleasePopupOpen, setIsReleasePopupOpen] = useState(false);
	const [releaseTargetRoom, setReleaseTargetRoom] = useState(null);
	const [releaseMode, setReleaseMode] = useState('checkout');
	const [releaseNote, setReleaseNote] = useState('');
	const [releaseMontantInput, setReleaseMontantInput] = useState("");
	const [isPayNowPopupOpen, setIsPayNowPopupOpen] = useState(false);
	const [payNowTargetRoom, setPayNowTargetRoom] = useState(null);
	const [payNowMontantInput, setPayNowMontantInput] = useState("");


	const resetRoomForm = () => {
		setRoomNumero('');
		setRoomType('Standard');
		setRoomCapacite('1');
		setRoomPrixNuit('0');
		setRoomDescription('');
	};

	const resetOccupancyForm = () => {
		setOccupancyMode('reservation');
		setOccupancyStayType('nuit');
		setOccupancyClientId('');
		setOccupancyName('');
		setOccupancyContact('');
		setOccupancyCin('');
		setOccupancyStart(toDateTimeLocal(new Date()));
		setOccupancyEnd('');
		setOccupancyNote('');
		setLockOccupancyMode(false);
		setIsDepositPopupOpen(false);
		setDepositInput('');
		setAvailabilityStatus('idle');
		setAvailabilityConflict(null);
		setAvailabilityMessage('');
	};

	const loadClients = useCallback(async () => {
		try {
			const response = await axios.get(`${API_URL}/api/clients/all`);
			if (response.status === 200) {
				setAllClients(Array.isArray(response.data) ? response.data : []);
			} else {
				toast.error('Erreur de chargement des clients');
			}
		} catch (err) {
			toast.error('Erreur de chargement des clients');
			console.log(err);
		}
	}, [API_URL]);

	const loadConditions = useCallback(async () => {
		try {
			const response = await axios.get(`${API_URL}/api/chambres/conditions`);
			if (response.status === 200 && response.data) {
				const hourlyPrices = {};
				const hourlyList = Array.isArray(response.data.hourly_prices) ? response.data.hourly_prices : [];
				hourlyList.forEach((entry) => {
					const key = normalizeRoomTypeKey(entry?.type);
					if (!key) return;
					const parsed = Number(String(entry?.prix_heure ?? '').replace(',', '.'));
					hourlyPrices[key] = Number.isFinite(parsed) ? parsed : 0;
				});
				const dayPrices = {};
				const dayList = Array.isArray(response.data.day_prices) ? response.data.day_prices : [];
				dayList.forEach((entry) => {
					const key = normalizeRoomTypeKey(entry?.type);
					if (!key) return;
					const parsed = Number(String(entry?.prix_journee ?? '').replace(',', '.'));
					dayPrices[key] = Number.isFinite(parsed) ? parsed : 0;
				});
				const nightlyPrices = {};
				const nightlyList = Array.isArray(response.data.nightly_prices) ? response.data.nightly_prices : [];
				nightlyList.forEach((entry) => {
					const key = normalizeRoomTypeKey(entry?.type);
					if (!key) return;
					const parsed = Number(String(entry?.prix_nuit ?? '').replace(',', '.'));
					nightlyPrices[key] = Number.isFinite(parsed) ? parsed : '';
				});
				const normalized = {
					checkin_time: response.data.checkin_time || DEFAULT_ROOM_CONDITION.checkin_time,
					checkout_time: response.data.checkout_time || DEFAULT_ROOM_CONDITION.checkout_time,
					day_checkin_time: response.data.day_checkin_time || DEFAULT_ROOM_CONDITION.day_checkin_time,
					day_checkout_time: response.data.day_checkout_time || DEFAULT_ROOM_CONDITION.day_checkout_time,
					cin_required_reservation: Boolean(response.data.cin_required_reservation),
					cin_required_occupation: Boolean(response.data.cin_required_occupation),
					deposit_percent: Number(response.data.deposit_percent) || 0,
					hourly_prices: hourlyPrices,
					day_prices: dayPrices,
					nightly_prices: nightlyPrices
				};
				setRoomCondition(normalized);
				setConditionForm(normalized);
			}
		} catch (err) {
			console.log('Erreur chargement conditions chambre:', err);
		}
	}, [API_URL]);


	const loadRooms = useCallback(async ({ resetSearch = true, query = appliedSearchValue } = {}) => {
		try {
			setIsTabLoading(true);
			const cleanedQuery = String(query ?? '').trim();
			const url = cleanedQuery
				? `${API_URL}/api/chambres/search?q=${encodeURIComponent(cleanedQuery)}`
				: `${API_URL}/api/chambres/all`;
			const response = await axios.get(url);
			if (response.status === 200) {
				setAllRooms(Array.isArray(response.data) ? response.data : []);
			} else {
				toast.error('Erreur de chargement des chambres');
			}
		} catch (err) {
			toast.error('Erreur de chargement des chambres');
			console.log(err);
		} finally {
			setIsTabLoading(false);
			if (resetSearch) {
				setSearchRoomValue('');
				setAppliedSearchValue('');
			}
		}
	}, [API_URL, appliedSearchValue]);

	const loadHistory = useCallback(async () => {
		try {
			setIsHistoryLoading(true);
			const params = new URLSearchParams();
			const query = String(appliedHistorySearchValue ?? '').trim();
			const status = String(historyStatusFilter ?? '').toLowerCase();

			if (query) params.set('q', query);
			if (status && status !== 'tout') params.set('status', status);
			if (startDateParam) params.set('startDate', startDateParam);
			if (endDateParam) params.set('endDate', endDateParam);

			const url = params.toString()
				? `${API_URL}/api/chambres/history?${params.toString()}`
				: `${API_URL}/api/chambres/history`;

			const response = await axios.get(url);
			if (response.status === 200) {
				setHistoryRecords(Array.isArray(response.data) ? response.data : []);
			} else {
				toast.error('Erreur de chargement historique');
			}
		} catch (err) {
			toast.error('Erreur de chargement historique');
			console.log(err);
		} finally {
			setIsHistoryLoading(false);
		}
	}, [API_URL, appliedHistorySearchValue, historyStatusFilter, startDateParam, endDateParam]);

	const loadActiveHistory = useCallback(async (roomId) => {
		if (!roomId) return;
		try {
			setIsActiveHistoryLoading(true);
			const response = await axios.get(`${API_URL}/api/chambres/${roomId}/history`);
			if (response.status === 200) {
				setActiveHistoryRecords(Array.isArray(response.data) ? response.data : []);
			} else {
				toast.error('Erreur de chargement des occupations actives');
			}
		} catch (err) {
			toast.error('Erreur de chargement des occupations actives');
			console.log(err);
		} finally {
			setIsActiveHistoryLoading(false);
		}
	}, [API_URL]);

	useEffect(() => {
		const init = async () => {
			setIsLoading(true);
			await Promise.all([
				loadRooms({ resetSearch: false }),
				loadClients(),
				loadConditions()
			]);
			setIsLoading(false);
		};

		init();
	}, [loadRooms, loadClients, loadConditions]);

	useEffect(() => {
		if (!isHistoryView) return;
		loadHistory();
	}, [isHistoryView, loadHistory]);

	useEffect(() => {
		if (!activeHistoryRoom?.id || isActiveHistoryLoading) return;
		const now = new Date();
		const expiredReservations = activeHistoryRecords.filter((entry) => {
			if (!entry?.id) return false;
			const occupationType = normalizeOccupationType(entry.type_occupation);
			const statusKey = normalizeOccupationStatus(entry.statut);
			if (occupationType !== 'reservation' || statusKey !== 'active') return false;
			const endDate = resolveDateValue(entry.date_fin_prevue);
			return Boolean(endDate && endDate <= now);
		});

		if (expiredReservations.length === 0) return;

		const cancelExpired = async () => {
			let hasUpdate = false;
			for (const entry of expiredReservations) {
				const entryId = Number(entry.id);
				if (!entryId || expiredReservationRef.current.has(entryId)) continue;
				expiredReservationRef.current.add(entryId);
				try {
					await axios.patch(`${API_URL}/api/chambres/${activeHistoryRoom.id}/release`, {
						mode: 'cancel',
						occupation_id: entryId
					});
					hasUpdate = true;
				} catch (err) {
					expiredReservationRef.current.delete(entryId);
					console.log(err);
				}
			}
			if (hasUpdate) {
				await loadActiveHistory(activeHistoryRoom.id);
			}
		};

		cancelExpired();
	}, [activeHistoryRoom, activeHistoryRecords, isActiveHistoryLoading, API_URL, loadActiveHistory]);

	useEffect(() => {
		if (roomRefreshTimeoutRef.current) {
			clearTimeout(roomRefreshTimeoutRef.current);
			roomRefreshTimeoutRef.current = null;
		}

		if (isHistoryView || activeHistoryRoom || isLoading) return undefined;

		const now = Date.now();
		const refreshTimes = [];

		allRooms.forEach((room) => {
			const nextStart = resolveDateValue(room?.next_date_debut);
			const currentEnd = resolveDateValue(room?.date_fin_prevue);
			if (nextStart && nextStart.getTime() > now) {
				refreshTimes.push(nextStart.getTime());
			}
			if (currentEnd && currentEnd.getTime() > now) {
				refreshTimes.push(currentEnd.getTime());
			}
		});

		if (refreshTimes.length === 0) return undefined;

		const nextTime = Math.min(...refreshTimes);
		const delay = Math.max(0, nextTime - now + 1000);
		const safeDelay = Math.min(delay, 2147483647);

		roomRefreshTimeoutRef.current = setTimeout(() => {
			if (isSubmitting || isTabLoading || isLoading) return;
			loadRooms({ resetSearch: false, query: appliedSearchValue });
		}, safeDelay);

		return () => {
			if (roomRefreshTimeoutRef.current) {
				clearTimeout(roomRefreshTimeoutRef.current);
				roomRefreshTimeoutRef.current = null;
			}
		};
	}, [allRooms, isHistoryView, activeHistoryRoom, isLoading, isSubmitting, isTabLoading, loadRooms, appliedSearchValue]);

	useRealtimeEvents(useCallback((event) => {
		if (!event) return;

		if (event.type === 'chambres-updated') {
			loadRooms({
				resetSearch: false,
				query: appliedSearchValue
			});
			if (isHistoryView) {
				loadHistory();
			}
			return;
		}

		if (event.type === 'chambres-conditions-updated') {
			loadConditions();
			return;
		}

		if (event.type === 'clients-updated') {
			loadClients();
		}
	}, [appliedSearchValue, loadClients, loadRooms, loadHistory, isHistoryView, loadConditions]));

	useEffect(() => {
		if (!isRoomPopupOpen && !isDeletePopupOpen && !isOccupancyPopupOpen && !isOccupancyConfirmOpen && !isReleasePopupOpen && !isPayNowPopupOpen && !isConditionPopupOpen && !isDepositPopupOpen && !isTimePickerOpen && !isDateTimePickerOpen) return undefined;

		const handleEscape = (event) => {
			if (event.key !== 'Escape' || isSubmitting) return;
			setIsRoomPopupOpen(false);
			setIsDeletePopupOpen(false);
			setIsOccupancyPopupOpen(false);
			setIsOccupancyConfirmOpen(false);
			setIsReleasePopupOpen(false);
			setIsPayNowPopupOpen(false);
			setIsConditionPopupOpen(false);
			setIsDepositPopupOpen(false);
			setIsTimePickerOpen(false);
			setTimePickerTarget(null);
			setIsDateTimePickerOpen(false);
			setDateTimePickerTarget(null);
			setReleaseMontantInput('');
			setDepositInput('');
			setDeleteRoomTarget(null);
			setOccupancyTargetRoom(null);
			setReleaseTargetRoom(null);
			setPayNowTargetRoom(null);
			setPayNowMontantInput('');
			setIsHistoryDetailOpen(false);
			setSelectedHistoryId(null);
		};

		document.addEventListener('keydown', handleEscape);
		return () => document.removeEventListener('keydown', handleEscape);
	}, [isRoomPopupOpen, isDeletePopupOpen, isOccupancyPopupOpen, isOccupancyConfirmOpen, isReleasePopupOpen, isPayNowPopupOpen, isConditionPopupOpen, isDepositPopupOpen, isTimePickerOpen, isDateTimePickerOpen, isSubmitting]);

	useEffect(() => {
		if (!isHistoryDetailOpen) return undefined;

		const handleEscape = (event) => {
			if (event.key !== 'Escape' || isSubmitting) return;
			setIsHistoryDetailOpen(false);
			setSelectedHistoryId(null);
		};

		document.addEventListener('keydown', handleEscape);
		return () => document.removeEventListener('keydown', handleEscape);
	}, [isHistoryDetailOpen, isSubmitting]);

	useEffect(() => {
		if (!isActiveHistoryDetailOpen) return undefined;

		const handleEscape = (event) => {
			if (event.key !== 'Escape' || isSubmitting) return;
			setIsActiveHistoryDetailOpen(false);
			setSelectedActiveHistoryId(null);
		};

		document.addEventListener('keydown', handleEscape);
		return () => document.removeEventListener('keydown', handleEscape);
	}, [isActiveHistoryDetailOpen, isSubmitting]);

	useEffect(() => {
		if (!isDateTimePickerOpen) return;
		const year = Number(dateTimePickerYear);
		const month = Number(dateTimePickerMonth);
		const day = Number(dateTimePickerDay);
		if (!year || !month || !day) return;
		const maxDay = getDaysInMonth(year, month);
		if (day > maxDay) {
			setDateTimePickerDay(String(maxDay).padStart(2, '0'));
		}
	}, [isDateTimePickerOpen, dateTimePickerYear, dateTimePickerMonth, dateTimePickerDay]);

	useEffect(() => {
		if (!isOccupancyPopupOpen || lockOccupancyMode) return;
		const stayType = normalizeStayType(occupancyStayType);
		const now = new Date();
		let start = now;
		let end = null;

		if (stayType === 'passage') {
			start = now;
			end = new Date(now);
			end.setHours(end.getHours() + 1);
		} else if (stayType === 'journee') {
			start = occupancyMode === 'occupation'
				? now
				: (alignDateTimeToCondition(now, roomCondition.day_checkin_time) || now);
			end = alignDateTimeToCondition(start, roomCondition.day_checkout_time) || new Date(start);
		} else {
			start = alignDateTimeToCondition(now, roomCondition.checkin_time) || now;
			end = new Date(start);
			end.setDate(end.getDate() + 1);
			end = alignDateTimeToCondition(end, roomCondition.checkout_time) || end;
		}

		setOccupancyStart(toDateTimeLocal(start));
		setOccupancyEnd(end ? toDateTimeLocal(end) : '');
	}, [
		isOccupancyPopupOpen,
		lockOccupancyMode,
		occupancyMode,
		occupancyStayType,
		roomCondition.checkin_time,
		roomCondition.checkout_time,
		roomCondition.day_checkin_time,
		roomCondition.day_checkout_time
	]);

	useEffect(() => {
		if (!isOccupancyPopupOpen) return;
		if (occupancyStayType !== 'passage') return;
		const start = resolveDateValue(occupancyStart) || new Date();
		const end = resolveDateValue(occupancyEnd);
		const durationHours = end ? (end.getTime() - start.getTime()) / (1000 * 60 * 60) : 0;
		if (!end || end <= start || durationHours > 12) {
			const next = new Date(start);
			next.setHours(next.getHours() + 1);
			setOccupancyEnd(toDateTimeLocal(next));
		}
	}, [isOccupancyPopupOpen, occupancyStayType, occupancyStart, occupancyEnd]);

	const getHourlyPriceForType = useCallback((type) => {
		const key = normalizeRoomTypeKey(type);
		const raw = roomCondition.hourly_prices?.[key];
		const parsed = Number(String(raw ?? '').replace(',', '.'));
		return Number.isFinite(parsed) ? parsed : 0;
	}, [roomCondition.hourly_prices]);

	const getDayPriceForType = useCallback((type) => {
		const key = normalizeRoomTypeKey(type);
		const raw = roomCondition.day_prices?.[key];
		const parsed = Number(String(raw ?? '').replace(',', '.'));
		return Number.isFinite(parsed) ? parsed : 0;
	}, [roomCondition.day_prices]);

	const roomRows = useMemo(() => {
		return allRooms.map((room) => {
			const statusKey = normalizeStatus(room.statut);
			const occupationTypeKey = normalizeOccupationType(room.type_occupation);
			const resolvedClientName = String(room.client_nom ?? '').trim();
			const resolvedOccupantName = String(room.occupant_nom ?? '').trim();
			const occupantDisplay = resolvedClientName || resolvedOccupantName || '-';
			const occupiedHourPrice = Number(room.occupation_prix_heure);
			const occupiedDayPrice = Number(room.occupation_prix_journee);
			const fallbackHourPrice = getHourlyPriceForType(room.type);
			const fallbackDayPrice = getDayPriceForType(room.type);
			const prixHeureValue = Number.isFinite(occupiedHourPrice) && occupiedHourPrice > 0
				? occupiedHourPrice
				: fallbackHourPrice;
			const prixJourneeValue = Number.isFinite(occupiedDayPrice) && occupiedDayPrice > 0
				? occupiedDayPrice
				: fallbackDayPrice;
			const formatMoneyValue = (value) => (
				Number.isFinite(value) && value > 0 ? `${formatNumberWithSpace(value)} Ar` : '-'
			);

			return {
				ID: room.id,
				occupation_id: room.occupation_id ? Number(room.occupation_id) : null,
				numero: String(room.numero ?? '-'),
				type: String(room.type ?? '-'),
				capacite: Number(room.capacite) || 0,
				raw_prix_nuit: Number(room.prix_nuit) || 0,
				prix_nuit: `${formatNumberWithSpace(room.prix_nuit)} Ar`,
				raw_prix_journee: Number.isFinite(prixJourneeValue) ? prixJourneeValue : 0,
				prix_journee: formatMoneyValue(prixJourneeValue),
				raw_prix_heure: Number.isFinite(prixHeureValue) ? prixHeureValue : 0,
				prix_heure: formatMoneyValue(prixHeureValue),
				statut: ROOM_STATUS_LABELS[statusKey],
				statut_key: statusKey,
				client: occupantDisplay,
				occupation: occupationTypeKey ? OCCUPATION_TYPE_LABELS[occupationTypeKey] : '-',
				occupation_key: occupationTypeKey,
				type_sejour: normalizeStayType(room.type_sejour),
				debut: formatDateTime(room.date_debut),
				fin_prevue: formatDateTime(room.date_fin_prevue),
				description: String(room.description ?? ''),
				client_id: room.client_id ? Number(room.client_id) : null,
				occupant_nom: resolvedOccupantName,
				occupant_contact: String(room.occupant_contact ?? '').trim(),
				occupant_cin: String(room.occupant_cin ?? '').trim(),
				client_cin: String(room.client_cin ?? '').trim(),
				occupation_note: String(room.occupation_note ?? '').trim(),
				raw_date_debut: room.date_debut,
				raw_date_fin_prevue: room.date_fin_prevue,
				raw_occupation_prix_nuit: Number(room.occupation_prix_nuit ?? room.prix_nuit) || 0,
				montant_total: Number(room.montant_total) || 0,
				montant_acompte: Number(room.montant_acompte) || 0,
				date_acompte: room.date_acompte,
				montant_solde: Number(room.montant_solde) || 0,
				date_solde: room.date_solde
			};
		});
	}, [allRooms, getHourlyPriceForType, getDayPriceForType]);

	const filteredHistoryRecords = useMemo(() => {
		return historyRecords.filter((entry) => normalizeOccupationStatus(entry.statut) !== 'active');
	}, [historyRecords]);

	const sortedHistoryRecords = useMemo(() => {
		const entries = [...filteredHistoryRecords];
		entries.sort((a, b) => {
			const aEnd = resolveDateValue(a.date_fin_reelle)
				|| resolveDateValue(a.date_fin_prevue)
				|| resolveDateValue(a.created_at);
			const bEnd = resolveDateValue(b.date_fin_reelle)
				|| resolveDateValue(b.date_fin_prevue)
				|| resolveDateValue(b.created_at);
			const aTime = aEnd ? aEnd.getTime() : 0;
			const bTime = bEnd ? bEnd.getTime() : 0;
			if (bTime !== aTime) return bTime - aTime;
			const aId = Number(a.id) || 0;
			const bId = Number(b.id) || 0;
			return bId - aId;
		});
		return entries;
	}, [filteredHistoryRecords]);

	const historyRows = useMemo(() => {
		return sortedHistoryRecords.map((entry, index) => {
			const occupationTypeKey = normalizeOccupationType(entry.type_occupation);
			const statusKey = normalizeOccupationStatus(entry.statut);
			const resolvedClientName = String(entry.client_nom ?? '').trim();
			const resolvedOccupantName = String(entry.occupant_nom ?? '').trim();
			const occupantDisplay = resolvedClientName || resolvedOccupantName || '-';
			const cinDisplay = String(entry.occupant_cin ?? '').trim()
				|| String(entry.client_cin ?? '').trim()
				|| '-';
			const contactDisplay = String(entry.occupant_contact ?? '').trim()
				|| String(entry.client_num_tel ?? '').trim()
				|| '-';
			const acompteValue = Number(entry.montant_acompte) || 0;
			const soldeValue = Number(entry.montant_solde) || 0;
			const totalReceived = calculateTotalReceived(entry);
			const numericId = Number(entry.id);
			const refValue = Number.isFinite(numericId) && numericId > 0 ? numericId : index + 1;

			return {
				ID: entry.id,
				ref: refValue,
				numero: String(entry.numero ?? '-'),
				type: String(entry.type ?? '-'),
				client: occupantDisplay,
				cin: cinDisplay,
				contact: contactDisplay,
				occupation: occupationTypeKey ? OCCUPATION_TYPE_LABELS[occupationTypeKey] : '-',
				statut: statusKey ? OCCUPATION_STATUS_LABELS[statusKey] : '-',
				debut: formatDateTime(entry.date_debut),
				fin_prevue: formatDateTime(entry.date_fin_prevue),
				fin_reelle: formatDateTime(entry.date_fin_reelle),
				acompte: `${formatNumberWithSpace(acompteValue)} Ar`,
				date_acompte: formatDateTime(entry.date_acompte),
				solde: `${formatNumberWithSpace(soldeValue)} Ar`,
				date_solde: formatDateTime(entry.date_solde),
				montant_recu: `${formatNumberWithSpace(totalReceived)} Ar`,
				raw: entry
			};
		});
	}, [sortedHistoryRecords]);

	const historyDetail = useMemo(() => {
		if (!selectedHistoryId) return null;
		const entry = sortedHistoryRecords.find((item) => Number(item.id) === Number(selectedHistoryId));
		if (!entry) return null;

		const occupationTypeKey = normalizeOccupationType(entry.type_occupation);
		const statusKey = normalizeOccupationStatus(entry.statut);
		const resolvedClientName = String(entry.client_nom ?? '').trim();
		const resolvedOccupantName = String(entry.occupant_nom ?? '').trim();
		const occupantDisplay = resolvedClientName || resolvedOccupantName || '-';
		const cinDisplay = String(entry.occupant_cin ?? '').trim()
			|| String(entry.client_cin ?? '').trim()
			|| '-';
		const contactDisplay = String(entry.occupant_contact ?? '').trim()
			|| String(entry.client_num_tel ?? '').trim()
			|| '-';
		const acompteValue = Number(entry.montant_acompte) || 0;
		const soldeValue = Number(entry.montant_solde) || 0;
		const totalReceived = calculateTotalReceived(entry);
		const montantTotal = Number(entry.montant_total) || 0;
		const prixNuit = Number(entry.prix_nuit) || 0;
		const stayTypeKey = normalizeStayType(entry.type_sejour);
		const startDate = resolveDateValue(entry.date_debut);
		const endDate = occupationTypeKey === 'reservation'
			? (resolveDateValue(entry.date_fin_prevue) || resolveDateValue(entry.date_fin_reelle))
			: (resolveDateValue(entry.date_fin_reelle) || resolveDateValue(entry.date_fin_prevue));
		let nightsCount = 0;
		let daysCount = 0;
		let extraHours = 0;
		if (stayTypeKey === 'nuit' && startDate && endDate) {
			const alignedStart = alignDateTimeToCondition(startDate, roomCondition.checkin_time);
			let alignedEnd = alignDateTimeToCondition(endDate, roomCondition.checkout_time);
			if (alignedStart && alignedEnd && alignedEnd <= alignedStart) {
				alignedEnd = new Date(alignedEnd);
				alignedEnd.setDate(alignedEnd.getDate() + 1);
			}
			nightsCount = calculateNights(alignedStart, alignedEnd);
			const earlyHours = alignedStart && startDate < alignedStart ? calculateHours(startDate, alignedStart) : 0;
			const lateHours = alignedEnd && endDate > alignedEnd ? calculateHours(alignedEnd, endDate) : 0;
			extraHours = earlyHours + lateHours;
		} else if (stayTypeKey === 'journee' && startDate && endDate) {
			const journeeExtras = calculateJourneeExtras(startDate, endDate, roomCondition.day_checkin_time, roomCondition.day_checkout_time);
			daysCount = journeeExtras.dayCount;
			extraHours = journeeExtras.extraHoursTotal;
		}
		let stayCountLabel = '';
		let stayCountValue = '-';
		if (stayTypeKey === 'nuit' && startDate && endDate) {
			stayCountLabel = 'Nombre de nuit';
			stayCountValue = String(nightsCount);
		} else if (stayTypeKey === 'journee' && startDate && endDate) {
			stayCountLabel = 'Nombre de journée';
			stayCountValue = String(daysCount);
		}
		const showExtraHours = stayTypeKey === 'nuit' || stayTypeKey === 'journee';
		const extraHoursDisplay = showExtraHours && startDate && endDate ? `${extraHours} h` : '-';

		return {
			numero: String(entry.numero ?? '-'),
			type: String(entry.type ?? '-'),
			client: occupantDisplay,
			cin: cinDisplay,
			contact: contactDisplay,
			occupation: occupationTypeKey ? OCCUPATION_TYPE_LABELS[occupationTypeKey] : '-',
			statut: statusKey ? OCCUPATION_STATUS_LABELS[statusKey] : '-',
			debut: formatDateTime(entry.date_debut),
			fin_prevue: formatDateTime(entry.date_fin_prevue),
			fin_reelle: formatDateTime(entry.date_fin_reelle),
			acompte: `${formatNumberWithSpace(acompteValue)} Ar`,
			date_acompte: formatDateTime(entry.date_acompte),
			solde: `${formatNumberWithSpace(soldeValue)} Ar`,
			date_solde: formatDateTime(entry.date_solde),
			montant_recu: `${formatNumberWithSpace(totalReceived)} Ar`,
			montant_total: `${formatNumberWithSpace(montantTotal)} Ar`,
			prix_nuit: prixNuit ? `${formatNumberWithSpace(prixNuit)} Ar` : '-',
			note: String(entry.note ?? '').trim() || '-',
			stay_count_label: stayCountLabel,
			stay_count_value: stayCountValue,
			heures_supp: extraHoursDisplay
		};
	}, [sortedHistoryRecords, selectedHistoryId, roomCondition]);

	const activeHistoryDetail = useMemo(() => {
		if (!selectedActiveHistoryId) return null;
		const entry = activeHistoryRecords.find((item) => Number(item.id) === Number(selectedActiveHistoryId));
		if (!entry) return null;

		const occupationTypeKey = normalizeOccupationType(entry.type_occupation);
		const resolvedClientName = String(entry.client_nom ?? '').trim();
		const resolvedOccupantName = String(entry.occupant_nom ?? '').trim();
		const occupantDisplay = resolvedClientName || resolvedOccupantName || '-';
		const cinDisplay = String(entry.occupant_cin ?? '').trim()
			|| String(entry.client_cin ?? '').trim()
			|| '-';
		const contactDisplay = String(entry.occupant_contact ?? '').trim()
			|| String(entry.client_num_tel ?? '').trim()
			|| '-';
		const stayLabel = STAY_TYPE_LABELS[normalizeStayType(entry.type_sejour)] || '-';
		const stayTypeKey = normalizeStayType(entry.type_sejour);
		const startDate = resolveDateValue(entry.date_debut);
		const endDate = resolveDateValue(entry.date_fin_prevue);
		let nightsCount = 0;
		let daysCount = 0;
		let extraHours = 0;
		if (stayTypeKey === 'nuit' && startDate && endDate) {
			const alignedStart = alignDateTimeToCondition(startDate, roomCondition.checkin_time);
			let alignedEnd = alignDateTimeToCondition(endDate, roomCondition.checkout_time);
			if (alignedStart && alignedEnd && alignedEnd <= alignedStart) {
				alignedEnd = new Date(alignedEnd);
				alignedEnd.setDate(alignedEnd.getDate() + 1);
			}
			nightsCount = calculateNights(alignedStart, alignedEnd);
			const earlyHours = alignedStart && startDate < alignedStart ? calculateHours(startDate, alignedStart) : 0;
			const lateHours = alignedEnd && endDate > alignedEnd ? calculateHours(alignedEnd, endDate) : 0;
			extraHours = earlyHours + lateHours;
		} else if (stayTypeKey === 'journee' && startDate && endDate) {
			const journeeExtras = calculateJourneeExtras(startDate, endDate, roomCondition.day_checkin_time, roomCondition.day_checkout_time);
			daysCount = journeeExtras.dayCount;
			extraHours = journeeExtras.extraHoursTotal;
		}
		let stayCountLabel = '';
		let stayCountValue = '-';
		if (stayTypeKey === 'nuit' && startDate && endDate) {
			stayCountLabel = 'Nombre de nuit';
			stayCountValue = String(nightsCount);
		} else if (stayTypeKey === 'journee' && startDate && endDate) {
			stayCountLabel = 'Nombre de journée';
			stayCountValue = String(daysCount);
		}
		const showExtraHours = stayTypeKey === 'nuit' || stayTypeKey === 'journee';
		const extraHoursDisplay = showExtraHours && startDate && endDate ? `${extraHours} h` : '-';
		const acompteValue = Number(entry.montant_acompte) || 0;
		const soldeValue = Number(entry.montant_solde) || 0;
		const totalReceived = calculateTotalReceived(entry);
		const montantTotal = Number(entry.montant_total) || 0;
		const prixNuit = Number(entry.prix_nuit) || 0;

		return {
			occupation: occupationTypeKey ? OCCUPATION_TYPE_LABELS[occupationTypeKey] : '-',
			sejour: stayLabel,
			prix_nuit: prixNuit ? `${formatNumberWithSpace(prixNuit)} Ar` : '-',
			stay_count_label: stayCountLabel,
			stay_count_value: stayCountValue,
			heures_supp: extraHoursDisplay,
			show_extra_hours: showExtraHours,
			client: occupantDisplay,
			cin: cinDisplay,
			contact: contactDisplay,
			note: String(entry.note ?? '').trim() || '-',
			debut: formatDateTime(entry.date_debut),
			fin_prevue: formatDateTime(entry.date_fin_prevue),
			fin_reelle: formatDateTime(entry.date_fin_reelle),
			acompte: `${formatNumberWithSpace(acompteValue)} Ar`,
			date_acompte: formatDateTime(entry.date_acompte),
			solde: `${formatNumberWithSpace(soldeValue)} Ar`,
			date_solde: formatDateTime(entry.date_solde),
			montant_total: `${formatNumberWithSpace(montantTotal)} Ar`,
			montant_recu: `${formatNumberWithSpace(totalReceived)} Ar`
		};
	}, [activeHistoryRecords, selectedActiveHistoryId, roomCondition]);

	const optionsInputSearch = useMemo(() => {
		const options = [];
		roomRows.forEach((row) => {
			options.push(row.numero);
			if (row.type && row.type !== '-') options.push(row.type);
			if (row.client && row.client !== '-') options.push(row.client);
		});
		return Array.from(new Set(options));
	}, [roomRows]);

	const optionsHistorySearch = useMemo(() => {
		const options = [];
		sortedHistoryRecords.forEach((entry) => {
			const numero = String(entry.numero ?? '').trim();
			const type = String(entry.type ?? '').trim();
			const client = String(entry.client_nom ?? entry.occupant_nom ?? '').trim();

			if (numero) options.push(numero);
			if (type) options.push(type);
			if (client) options.push(client);
		});
		return Array.from(new Set(options));
	}, [sortedHistoryRecords]);

	const optionsActiveHistorySearch = useMemo(() => {
		const options = [];
		activeHistoryRecords.forEach((entry) => {
			const client = String(entry.client_nom ?? entry.occupant_nom ?? '').trim();
			const contact = String(entry.occupant_contact ?? entry.client_num_tel ?? '').trim();
			const cin = String(entry.occupant_cin ?? entry.client_cin ?? '').trim();

			if (client) options.push(client);
			if (contact) options.push(contact);
			if (cin) options.push(cin);
		});
		return Array.from(new Set(options));
	}, [activeHistoryRecords]);

	const optionsClientSelect = useMemo(() => {
		return allClients
			.map((client) => {
				const nom = String(client.nom ?? '').trim();
				const prenom = String(client.prenom ?? '').trim();
				const displayName = `${nom} ${prenom}`.trim() || `Client #${client.id}`;
				return {
					id: Number(client.id),
					name: displayName,
					contact: String(client.numTel ?? '').trim(),
					cin: String(client.numberCNI ?? '').trim()
				};
			})
			.filter((entry) => Number.isFinite(entry.id));
	}, [allClients]);

	const occupancyConfirmSummary = useMemo(() => {
		const selectedClient = occupancyClientId
			? optionsClientSelect.find((entry) => String(entry.id) === String(occupancyClientId))
			: null;
		const clientName = String(occupancyName ?? '').trim()
			|| String(selectedClient?.name ?? '').trim()
			|| '-';
		const contactValue = String(occupancyContact ?? '').trim()
			|| String(selectedClient?.contact ?? '').trim()
			|| '-';
		const cinValue = String(occupancyCin ?? '').trim()
			|| String(selectedClient?.cin ?? '').trim()
			|| '-';
		const startValue = occupancyStart ? formatDateTimeDisplay(occupancyStart) : '-';
		const endValue = occupancyEnd ? formatDateTimeDisplay(occupancyEnd) : '-';
		const stayLabel = STAY_TYPE_LABELS[normalizeStayType(occupancyStayType)] || '-';
		const modeLabel = OCCUPANCY_MODE_LABELS[occupancyMode] || occupancyMode || '-';
		return {
			client: clientName,
			contact: contactValue,
			cin: cinValue,
			start: startValue || '-',
			end: endValue || '-',
			stay: stayLabel,
			mode: modeLabel
		};
	}, [occupancyClientId, occupancyName, occupancyContact, occupancyCin, occupancyStart, occupancyEnd, occupancyStayType, occupancyMode, optionsClientSelect]);

	const activeHistoryRows = useMemo(() => {
		if (!activeHistoryRoom) return [];
		const selectedDay = toDateOnly(activeHistoryDate);
		if (!selectedDay) return [];
		const searchValue = String(activeHistorySearchValue ?? '').trim().toLowerCase();
		const occupationFilter = String(activeHistoryOccupationFilter ?? '').toLowerCase();

		return activeHistoryRecords
			.filter((entry) => String(entry?.statut ?? '').toLowerCase() === 'active')
			.filter((entry) => {
				const start = entry?.date_debut ? new Date(entry.date_debut) : null;
				const end = entry?.date_fin_reelle
					? new Date(entry.date_fin_reelle)
					: (entry?.date_fin_prevue ? new Date(entry.date_fin_prevue) : null);
				if (!start || Number.isNaN(start.getTime())) return false;
				const safeEnd = end && !Number.isNaN(end.getTime()) ? end : start;
				return isDateInRangeInclusive(selectedDay, start, safeEnd);
			})
			.filter((entry) => {
				if (!occupationFilter || occupationFilter === 'tout') return true;
				return normalizeOccupationType(entry.type_occupation) === occupationFilter;
			})
			.filter((entry) => {
				if (!searchValue) return true;
				const clientName = String(entry.client_nom ?? '').trim();
				const occupantName = String(entry.occupant_nom ?? '').trim();
				const contact = String(entry.occupant_contact ?? entry.client_num_tel ?? '').trim();
				const cin = String(entry.occupant_cin ?? entry.client_cin ?? '').trim();
				const haystack = `${clientName} ${occupantName} ${contact} ${cin}`.toLowerCase();
				return haystack.includes(searchValue);
			})
			.map((entry) => {
				const clientName = String(entry.client_nom ?? '').trim();
				const occupantName = String(entry.occupant_nom ?? '').trim();
				const displayName = clientName || occupantName || '-';
				const cinDisplay = String(entry.occupant_cin ?? '').trim()
					|| String(entry.client_cin ?? '').trim()
					|| '-';
				const contactDisplay = String(entry.occupant_contact ?? '').trim()
					|| String(entry.client_num_tel ?? '').trim()
					|| '-';
				return {
					ID: entry.id,
					client: displayName,
					contact: contactDisplay,
					cin: cinDisplay,
					occupation: OCCUPATION_TYPE_LABELS[normalizeOccupationType(entry.type_occupation)] || '-',
					sejour: STAY_TYPE_LABELS[normalizeStayType(entry.type_sejour)] || '-',
					debut: formatDateTime(entry.date_debut),
					fin_prevue: formatDateTime(entry.date_fin_prevue)
				};
			});
	}, [activeHistoryRoom, activeHistoryRecords, activeHistoryDate, activeHistorySearchValue, activeHistoryOccupationFilter]);

	const activeHistoryRecordById = useMemo(() => {
		const map = new Map();
		activeHistoryRecords.forEach((entry) => {
			if (!entry?.id) return;
			map.set(Number(entry.id), entry);
		});
		return map;
	}, [activeHistoryRecords]);

	const activeCalendarWeeks = useMemo(() => {
		const base = getMonthStart(activeHistoryMonth);
		const baseDay = base.getDay();
		const mondayIndex = (baseDay + 6) % 7;
		const start = new Date(base);
		start.setDate(base.getDate() - mondayIndex);
		const weeks = [];
		for (let w = 0; w < 6; w += 1) {
			const days = [];
			for (let d = 0; d < 7; d += 1) {
				const current = new Date(start);
				current.setDate(start.getDate() + (w * 7) + d);
				days.push({
					date: current,
					inMonth: current.getMonth() === base.getMonth()
				});
			}
			weeks.push(days);
		}
		return weeks;
	}, [activeHistoryMonth]);

	const activeMonthLabel = useMemo(() => {
		const base = getMonthStart(activeHistoryMonth);
		return base.toLocaleDateString('fr-FR', { month: 'long' });
	}, [activeHistoryMonth]);

	const activeYearValue = useMemo(() => {
		return getMonthStart(activeHistoryMonth).getFullYear();
	}, [activeHistoryMonth]);

	const activeYearRangeLabel = useMemo(() => {
		return `${activeYearPageStart} - ${activeYearPageStart + 11}`;
	}, [activeYearPageStart]);

	useEffect(() => {
		if (activeCalendarView !== 'year') return;
		const year = getMonthStart(activeHistoryMonth).getFullYear();
		setActiveYearPageStart(year - (year % 12));
	}, [activeCalendarView, activeHistoryMonth]);

	const roomTypes = useMemo(() => {
		const types = allRooms
			.map((room) => String(room.type ?? '').trim())
			.filter((type) => type);
		return Array.from(new Set(types)).sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
	}, [allRooms]);

	const activeHistoryBaseRoom = useMemo(() => {
		if (!activeHistoryRoom?.id) return null;
		const roomId = Number(activeHistoryRoom.id);
		return roomRows.find((row) => Number(row.ID || row.id) === roomId) || null;
	}, [activeHistoryRoom, roomRows]);

	const activeHistorySummary = useMemo(() => {
		if (!activeHistoryRoom && !activeHistoryBaseRoom) return null;
		const baseRoom = activeHistoryBaseRoom || {};
		const numero = String(activeHistoryRoom?.numero ?? baseRoom.numero ?? '').trim() || '-';
		const type = String(activeHistoryRoom?.type ?? baseRoom.type ?? '').trim() || '-';
		const statut = String(baseRoom.statut ?? '').trim()
			|| (baseRoom.statut_key ? ROOM_STATUS_LABELS[normalizeStatus(baseRoom.statut_key)] : '')
			|| '-';
		return { numero, type, statut };
	}, [activeHistoryRoom, activeHistoryBaseRoom]);

	const buildActiveHistoryActionRow = useCallback((entry) => {
		if (!entry) return null;
		const baseRoom = activeHistoryBaseRoom || {};
		const occupationType = normalizeOccupationType(entry.type_occupation);
		const statusKey = occupationType === 'reservation'
			? 'reservee'
			: (occupationType === 'occupation' ? 'occupee' : normalizeStatus(baseRoom.statut_key));
		const resolvedClientName = String(entry.client_nom ?? '').trim();
		const resolvedOccupantName = String(entry.occupant_nom ?? '').trim();
		const occupantDisplay = resolvedClientName || resolvedOccupantName || '-';
		const roomId = Number(activeHistoryRoom?.id ?? baseRoom.ID ?? baseRoom.id ?? entry.chambre_id);

		return {
			id: roomId,
			ID: roomId,
			occupation_id: entry.id ? Number(entry.id) : null,
			numero: String(activeHistoryRoom?.numero ?? baseRoom.numero ?? ''),
			type: String(activeHistoryRoom?.type ?? baseRoom.type ?? ''),
			statut_key: statusKey,
			occupation_key: occupationType,
			type_sejour: normalizeStayType(entry.type_sejour),
			client_id: entry.client_id ? Number(entry.client_id) : null,
			client: occupantDisplay,
			occupant_nom: resolvedOccupantName,
			occupant_contact: String(entry.occupant_contact ?? '').trim(),
			occupant_cin: String(entry.occupant_cin ?? '').trim(),
			client_cin: String(entry.client_cin ?? '').trim(),
			occupation_note: String(entry.note ?? '').trim(),
			raw_date_debut: entry.date_debut,
			raw_date_fin_prevue: entry.date_fin_prevue,
			raw_occupation_prix_nuit: Number(entry.prix_nuit) || 0,
			raw_prix_nuit: Number(entry.prix_nuit ?? baseRoom.raw_prix_nuit) || 0,
			raw_prix_heure: Number(entry.prix_heure ?? baseRoom.raw_prix_heure) || 0,
			raw_prix_journee: Number(entry.prix_journee ?? baseRoom.raw_prix_journee) || 0,
			montant_total: Number(entry.montant_total) || 0,
			montant_acompte: Number(entry.montant_acompte) || 0
		};
	}, [activeHistoryBaseRoom, activeHistoryRoom]);

	const nightlyPriceByType = useMemo(() => {
		const tracker = {};
		allRooms.forEach((room) => {
			const typeKey = normalizeRoomTypeKey(room.type);
			if (!typeKey) return;
			const price = Number(room.prix_nuit);
			if (!Number.isFinite(price)) return;
			if (!tracker[typeKey]) {
				tracker[typeKey] = { min: price, max: price };
				return;
			}
			tracker[typeKey].min = Math.min(tracker[typeKey].min, price);
			tracker[typeKey].max = Math.max(tracker[typeKey].max, price);
		});
		const result = {};
		roomTypes.forEach((type) => {
			const key = normalizeRoomTypeKey(type);
			const entry = tracker[key];
			if (!entry) {
				result[key] = '';
				return;
			}
			result[key] = entry.min === entry.max ? entry.min : '';
		});
		return result;
	}, [allRooms, roomTypes]);

	const selectedHourlyKey = normalizeRoomTypeKey(hourlyTypeSelection);
	const selectedDayKey = normalizeRoomTypeKey(dayTypeSelection);
	const selectedNightlyKey = normalizeRoomTypeKey(nightlyTypeSelection);
	const selectedHourlyValue = selectedHourlyKey ? (conditionForm.hourly_prices?.[selectedHourlyKey] ?? '') : '';
	const selectedDayValue = selectedDayKey ? (conditionForm.day_prices?.[selectedDayKey] ?? '') : '';
	const selectedNightlyValue = selectedNightlyKey ? (conditionForm.nightly_prices?.[selectedNightlyKey] ?? '') : '';

	useEffect(() => {
		if (!isConditionPopupOpen) return;
		if (roomTypes.length === 0) return;
		setHourlyTypeSelection((prev) => (roomTypes.includes(prev) ? prev : roomTypes[0]));
		setDayTypeSelection((prev) => (roomTypes.includes(prev) ? prev : roomTypes[0]));
		setNightlyTypeSelection((prev) => (roomTypes.includes(prev) ? prev : roomTypes[0]));
	}, [isConditionPopupOpen, roomTypes]);

	const reservationSummary = useMemo(() => {
		if (!occupancyTargetRoom) {
			return {
				nights: 0,
				days: 0,
				hours: 0,
				total: 0,
				minDeposit: 0,
				alignedStart: null,
				alignedEnd: null,
				stayType: 'nuit',
				durationLabel: '',
				isJourneeTimeValid: true
			};
		}
		const stayType = normalizeStayType(occupancyStayType);
		const start = resolveDateValue(occupancyStart) || new Date();
		const end = resolveDateValue(occupancyEnd);
		const priceNuit = Number(occupancyTargetRoom.prix_nuit) || 0;
		const hourlyPrice = getHourlyPriceForType(occupancyTargetRoom.type);
		const dayPrice = getDayPriceForType(occupancyTargetRoom.type);
		let nights = 0;
		let days = 0;
		let hours = 0;
		let total = 0;
		let alignedStart = null;
		let alignedEnd = null;
		let extraHoursTotal = 0;
		let isJourneeTimeValid = true;

		if (stayType === 'passage') {
			if (end) {
				hours = calculateHours(start, end);
				total = hours > 0 && hourlyPrice > 0 ? Number((hours * hourlyPrice).toFixed(2)) : 0;
			}
		} else if (stayType === 'journee') {
			const journeeExtras = calculateJourneeExtras(start, end, roomCondition.day_checkin_time, roomCondition.day_checkout_time);
			days = journeeExtras.dayCount;
			extraHoursTotal = journeeExtras.extraHoursTotal;
			isJourneeTimeValid = journeeExtras.isTimeValid;
			const baseTotal = days > 0 && dayPrice > 0 ? Number((days * dayPrice).toFixed(2)) : 0;
			const extraTotal = extraHoursTotal > 0 && hourlyPrice > 0
				? Number((extraHoursTotal * hourlyPrice).toFixed(2))
				: 0;
			total = isJourneeTimeValid ? Number((baseTotal + extraTotal).toFixed(2)) : 0;
		} else {
			alignedStart = alignDateTimeToCondition(start, roomCondition.checkin_time);
			alignedEnd = end ? alignDateTimeToCondition(end, roomCondition.checkout_time) : null;
			nights = calculateNights(alignedStart, alignedEnd);
			const baseTotal = nights > 0 && priceNuit > 0 ? Number((nights * priceNuit).toFixed(2)) : 0;
			const earlyHours = alignedStart && start < alignedStart ? calculateHours(start, alignedStart) : 0;
			const earlyTotal = earlyHours > 0 && hourlyPrice > 0 ? Number((earlyHours * hourlyPrice).toFixed(2)) : 0;
			const lateHours = alignedEnd && end && end > alignedEnd ? calculateHours(alignedEnd, end) : 0;
			const lateTotal = lateHours > 0 && hourlyPrice > 0 ? Number((lateHours * hourlyPrice).toFixed(2)) : 0;
			total = Number((baseTotal + earlyTotal + lateTotal).toFixed(2));
			extraHoursTotal = (earlyHours + lateHours);
		}

		const percent = Number(roomCondition.deposit_percent) || 0;
		const minDeposit = Number(((total * percent) / 100).toFixed(2));
		const extraHours = (stayType === 'nuit' || stayType === 'journee') && hourlyPrice > 0
			? extraHoursTotal
			: 0;
		const durationLabel = stayType === 'passage'
			? (hours > 0 ? `${hours} heure${hours > 1 ? 's' : ''}` : '')
			: (stayType === 'journee'
				? (days > 0 ? `${days} journée${days > 1 ? 's' : ''}` : '')
				: (nights > 0 ? `${nights} nuit${nights > 1 ? 's' : ''}` : ''));
		const durationLabelWithExtras = (stayType === 'nuit' || stayType === 'journee') && extraHours > 0
			? `${durationLabel}${durationLabel ? ' + ' : ''}${extraHours} h`
			: durationLabel;
		return {
			nights,
			days,
			hours,
			total,
			minDeposit,
			alignedStart,
			alignedEnd,
			stayType,
			durationLabel: durationLabelWithExtras,
			isJourneeTimeValid
		};
	}, [occupancyStart, occupancyEnd, occupancyTargetRoom, occupancyStayType, roomCondition, getHourlyPriceForType, getDayPriceForType]);

	const occupancyTotalLabel = useMemo(() => {
		const totalValue = Number(reservationSummary.total);
		if (!Number.isFinite(totalValue) || totalValue <= 0) return '-';
		return `${formatNumberWithSpace(totalValue)} Ar`;
	}, [reservationSummary.total]);

	const occupancyDepositLabel = useMemo(() => {
		const depositValue = Number(reservationSummary.minDeposit);
		if (!Number.isFinite(depositValue)) return '-';
		return `${formatNumberWithSpace(depositValue)} Ar`;
	}, [reservationSummary.minDeposit]);

	const isEditingReservation = useMemo(() => {
		return Boolean(occupancyTargetRoom?.occupation_id) && occupancyMode === 'reservation';
	}, [occupancyTargetRoom, occupancyMode]);

	const existingReservationDeposit = useMemo(() => {
		if (!isEditingReservation) return 0;
		return Number(occupancyTargetRoom?.montant_acompte) || 0;
	}, [isEditingReservation, occupancyTargetRoom]);

	const requiredReservationDeposit = useMemo(() => {
		const minDeposit = Number(reservationSummary.minDeposit) || 0;
		const remaining = minDeposit - existingReservationDeposit;
		if (!Number.isFinite(remaining) || remaining <= 0) return 0;
		return Number(remaining.toFixed(2));
	}, [reservationSummary.minDeposit, existingReservationDeposit]);

	const occupancyExistingDepositLabel = useMemo(() => {
		if (!isEditingReservation) return '-';
		return `${formatNumberWithSpace(existingReservationDeposit)} Ar`;
	}, [isEditingReservation, existingReservationDeposit]);

	const occupancyDueDepositLabel = useMemo(() => {
		if (!isEditingReservation) return '-';
		return `${formatNumberWithSpace(requiredReservationDeposit)} Ar`;
	}, [isEditingReservation, requiredReservationDeposit]);

	const releaseSummary = useMemo(() => {
		return computeReleaseSummary(releaseTargetRoom, roomCondition);
	}, [releaseTargetRoom, roomCondition]);

	const payNowSummary = useMemo(() => {
		return computeReleaseSummary(payNowTargetRoom, roomCondition);
	}, [payNowTargetRoom, roomCondition]);

	const releaseHasKnownTotal = Number.isFinite(releaseSummary.total);
	const releaseIsPaid = releaseHasKnownTotal && releaseSummary.reste <= 0;
	const payNowHasKnownTotal = Number(payNowTargetRoom?.montant_total) > 0;
	const payNowIsPaid = payNowHasKnownTotal && payNowSummary.reste <= 0;

	const parsedDepositInput = parseAmountInput(depositInput);
	const depositValue = parsedDepositInput.isValid ? parsedDepositInput.value : 0;
	const depositReste = Math.max(0, reservationSummary.total - (depositValue + (isEditingReservation ? existingReservationDeposit : 0)));

	const parsedReleaseInput = parseAmountInput(releaseMontantInput);
	const releaseValue = parsedReleaseInput.isValid ? parsedReleaseInput.value : 0;
	const releaseResteApres = Math.max(0, releaseSummary.reste - releaseValue);
	const releaseARendre = Math.max(0, releaseValue - releaseSummary.reste);
	const parsedPayNowInput = parseAmountInput(payNowMontantInput);
	const payNowValue = parsedPayNowInput.isValid ? parsedPayNowInput.value : 0;
	const payNowResteApres = Math.max(0, payNowSummary.reste - payNowValue);
	const payNowARendre = Math.max(0, payNowValue - payNowSummary.reste);



	const applySearchValue = useCallback((searchValue = searchRoomValue) => {
		setAppliedSearchValue(String(searchValue ?? '').trim());
		loadRooms({
			resetSearch: false,
			query: searchValue
		});
	}, [loadRooms, searchRoomValue]);

	const applyHistorySearchValue = useCallback((searchValue = historySearchValue) => {
		setAppliedHistorySearchValue(String(searchValue ?? '').trim());
	}, [historySearchValue]);

	const applyActiveHistorySearchValue = useCallback((searchValue = activeHistorySearchValue) => {
		setActiveHistorySearchValue(String(searchValue ?? '').trim());
	}, [activeHistorySearchValue]);

	const handleSearchKeyDown = (event) => {
		if (event.key === 'Enter') {
			event.preventDefault();
			applySearchValue(event.target.value);
		}
	};

	const handleHistorySearchKeyDown = (event) => {
		if (event.key === 'Enter') {
			event.preventDefault();
			applyHistorySearchValue(event.target.value);
		}
	};

	const handleActiveHistorySearchKeyDown = (event) => {
		if (event.key === 'Enter') {
			event.preventDefault();
			applyActiveHistorySearchValue(event.target.value);
		}
	};

	const createRow = (row, index) => ({
		id: row.ID || index,
		occupation_id: row.occupation_id,
		numero: row.numero,
		type: row.type,
		capacite: row.capacite,
		raw_prix_nuit: row.raw_prix_nuit,
		prix_nuit: row.prix_nuit,
		raw_prix_journee: row.raw_prix_journee,
		prix_journee: row.prix_journee,
		raw_prix_heure: row.raw_prix_heure,
		prix_heure: row.prix_heure,
		statut: row.statut,
		statut_key: row.statut_key,
		client: row.client,
		occupant_cin: row.occupant_cin,
		client_cin: row.client_cin,
		occupation: row.occupation,
		occupation_key: row.occupation_key,
		debut: row.debut,
		fin_prevue: row.fin_prevue,
		description: row.description,
		client_id: row.client_id,
		occupant_nom: row.occupant_nom,
		occupant_contact: row.occupant_contact,
		occupation_note: row.occupation_note,
		raw_date_debut: row.raw_date_debut,
		raw_date_fin_prevue: row.raw_date_fin_prevue,
		raw_occupation_prix_nuit: row.raw_occupation_prix_nuit,
		montant_total: row.montant_total,
		montant_acompte: row.montant_acompte,
		date_acompte: row.date_acompte,
		montant_solde: row.montant_solde,
		date_solde: row.date_solde
	});

	const createHistoryRow = (row, index) => ({
		id: row.ID || index,
		ref: row.ref,
		numero: row.numero,
		type: row.type,
		client: row.client,
		cin: row.cin,
		contact: row.contact,
		occupation: row.occupation,
		statut: row.statut,
		debut: row.debut,
		fin_prevue: row.fin_prevue,
		fin_reelle: row.fin_reelle,
		acompte: row.acompte,
		date_acompte: row.date_acompte,
		solde: row.solde,
		date_solde: row.date_solde,
		montant_recu: row.montant_recu
	});

	const createActiveHistoryRow = (row, index) => ({
		id: row.ID || index,
		client: row.client,
		contact: row.contact,
		cin: row.cin,
		sejour: row.sejour,
		occupation: row.occupation,
		debut: row.debut,
		fin_prevue: row.fin_prevue
	});

	const openHistoryDetail = (rowId) => {
		if (!rowId) return;
		setSelectedHistoryId(rowId);
		setIsHistoryDetailOpen(true);
	};

	const openActiveHistoryDetail = (rowId) => {
		if (!rowId) return;
		setSelectedActiveHistoryId(rowId);
		setIsActiveHistoryDetailOpen(true);
	};

	const openActiveHistory = async (roomRow) => {
		if (!roomRow) return;
		const roomId = Number(roomRow.ID || roomRow.id);
		if (!roomId) return;
		setIsActiveHistoryDetailOpen(false);
		setSelectedActiveHistoryId(null);
		setActiveHistorySearchValue('');
		setActiveHistoryOccupationFilter('tout');
		setActiveHistoryRoom({
			id: roomId,
			numero: String(roomRow.numero ?? ''),
			type: String(roomRow.type ?? '')
		});
		setActiveHistoryRecords([]);
		const today = new Date();
		setActiveHistoryDate(today);
		setActiveHistoryMonth(getMonthStart(today));
		setActiveCalendarView('day');
		setActiveYearPageStart(today.getFullYear() - (today.getFullYear() % 12));
		await loadActiveHistory(roomId);
	};

	const closeActiveHistory = () => {
		setActiveHistoryRoom(null);
		setActiveHistoryRecords([]);
		setIsActiveHistoryDetailOpen(false);
		setSelectedActiveHistoryId(null);
		setActiveHistorySearchValue('');
		setActiveHistoryOccupationFilter('tout');
		setActiveCalendarView('day');
	};

	const closeHistoryDetail = (force = false) => {
		if (isSubmitting && !force) return;
		setIsHistoryDetailOpen(false);
		setSelectedHistoryId(null);
	};

	const closeActiveHistoryDetail = (force = false) => {
		if (isSubmitting && !force) return;
		setIsActiveHistoryDetailOpen(false);
		setSelectedActiveHistoryId(null);
	};

	const openConditionPopup = () => {
		const mergedNightlyPrices = { ...nightlyPriceByType };
		Object.entries(roomCondition.nightly_prices || {}).forEach(([key, value]) => {
			if (value !== undefined && value !== null && String(value).trim() !== '') {
				mergedNightlyPrices[key] = value;
			}
		});
		const defaultType = roomTypes[0] || '';
		setConditionForm({
			checkin_time: roomCondition.checkin_time || DEFAULT_ROOM_CONDITION.checkin_time,
			checkout_time: roomCondition.checkout_time || DEFAULT_ROOM_CONDITION.checkout_time,
			day_checkin_time: roomCondition.day_checkin_time || DEFAULT_ROOM_CONDITION.day_checkin_time,
			day_checkout_time: roomCondition.day_checkout_time || DEFAULT_ROOM_CONDITION.day_checkout_time,
			cin_required_reservation: Boolean(roomCondition.cin_required_reservation),
			cin_required_occupation: Boolean(roomCondition.cin_required_occupation),
			deposit_percent: Number(roomCondition.deposit_percent) || 0,
			hourly_prices: roomCondition.hourly_prices || {},
			day_prices: roomCondition.day_prices || {},
			nightly_prices: mergedNightlyPrices
		});
		setHourlyTypeSelection((prev) => (roomTypes.includes(prev) ? prev : defaultType));
		setDayTypeSelection((prev) => (roomTypes.includes(prev) ? prev : defaultType));
		setNightlyTypeSelection((prev) => (roomTypes.includes(prev) ? prev : defaultType));
		setIsConditionPopupOpen(true);
	};

	const closeConditionPopup = (force = false) => {
		if (isSubmitting && !force) return;
		setIsConditionPopupOpen(false);
		setConditionForm(roomCondition);
		setIsTimePickerOpen(false);
		setTimePickerTarget(null);
		setIsDateTimePickerOpen(false);
		setDateTimePickerTarget(null);
	};

	const openTimePicker = (target) => {
		if (isSubmitting) return;
		let currentValue = conditionForm.checkin_time;
		let fallbackValue = DEFAULT_ROOM_CONDITION.checkin_time;
		if (target === 'checkout') {
			currentValue = conditionForm.checkout_time;
			fallbackValue = DEFAULT_ROOM_CONDITION.checkout_time;
		} else if (target === 'day_checkin') {
			currentValue = conditionForm.day_checkin_time;
			fallbackValue = DEFAULT_ROOM_CONDITION.day_checkin_time;
		} else if (target === 'day_checkout') {
			currentValue = conditionForm.day_checkout_time;
			fallbackValue = DEFAULT_ROOM_CONDITION.day_checkout_time;
		}
		const parsed = parseTimeParts(currentValue) || parseTimeParts(fallbackValue);
		const hours = parsed ? parsed.hours : 0;
		const minutes = parsed ? parsed.minutes : 0;
		setTimePickerHour(String(hours).padStart(2, '0'));
		setTimePickerMinute(String(minutes).padStart(2, '0'));
		setTimePickerTarget(target);
		setIsTimePickerOpen(true);
	};

	const closeTimePicker = (force = false) => {
		if (isSubmitting && !force) return;
		setIsTimePickerOpen(false);
		setTimePickerTarget(null);
	};

	const confirmTimePicker = () => {
		if (!timePickerTarget) return;
		const newValue = `${timePickerHour}:${timePickerMinute}`;
		if (timePickerTarget === 'checkout') {
			setConditionForm((prev) => ({ ...prev, checkout_time: newValue }));
		} else if (timePickerTarget === 'day_checkin') {
			setConditionForm((prev) => ({ ...prev, day_checkin_time: newValue }));
		} else if (timePickerTarget === 'day_checkout') {
			setConditionForm((prev) => ({ ...prev, day_checkout_time: newValue }));
		} else {
			setConditionForm((prev) => ({ ...prev, checkin_time: newValue }));
		}
		closeTimePicker(true);
	};

	const openDateTimePicker = (target) => {
		if (isSubmitting) return;
		let baseDate = null;
		if (target === 'start') {
			baseDate = resolveDateValue(occupancyStart);
			if (!baseDate) {
				baseDate = new Date();
			}
		} else {
			baseDate = resolveDateValue(occupancyEnd);
			if (!baseDate) {
				const startBase = resolveDateValue(occupancyStart) || new Date();
				baseDate = new Date(startBase);
				baseDate.setDate(baseDate.getDate() + 1);
			}
		}

		setDateTimePickerYear(String(baseDate.getFullYear()));
		setDateTimePickerMonth(String(baseDate.getMonth() + 1).padStart(2, '0'));
		setDateTimePickerDay(String(baseDate.getDate()).padStart(2, '0'));
		setDateTimePickerHour(String(baseDate.getHours()).padStart(2, '0'));
		setDateTimePickerMinute(String(baseDate.getMinutes()).padStart(2, '0'));
		setDateTimePickerTarget(target);
		setIsDateTimePickerOpen(true);
	};

	const closeDateTimePicker = (force = false) => {
		if (isSubmitting && !force) return;
		setIsDateTimePickerOpen(false);
		setDateTimePickerTarget(null);
	};

	const confirmDateTimePicker = () => {
		if (!dateTimePickerTarget) return;
		const year = Number(dateTimePickerYear);
		const month = Number(dateTimePickerMonth);
		const day = Number(dateTimePickerDay);
		const hour = Number(dateTimePickerHour);
		const minute = Number(dateTimePickerMinute);
		const maxDay = getDaysInMonth(year, month);
		const safeDay = Math.min(Math.max(day || 1, 1), maxDay);
		const date = new Date(year, month - 1, safeDay, hour || 0, minute || 0, 0, 0);
		const value = toDateTimeLocal(date);
		if (dateTimePickerTarget === 'end') {
			setOccupancyEnd(value);
		} else {
			setOccupancyStart(value);
		}
		closeDateTimePicker(true);
	};

	const refreshCurrentTable = async ({ includeAux = false } = {}) => {
		if (isHistoryView) {
			await loadHistory();
			return;
		}
		if (activeHistoryRoom?.id) {
			await loadActiveHistory(activeHistoryRoom.id);
			return;
		}
		if (includeAux) {
			await Promise.all([
				loadRooms({ resetSearch: false, query: appliedSearchValue }),
				loadClients(),
				loadConditions()
			]);
			return;
		}
		await loadRooms({ resetSearch: false, query: appliedSearchValue });
	};

	const handleSaveCondition = async () => {
		if (isSubmitting) return;
		const parsedCheckin = parseTimeParts(conditionForm.checkin_time);
		const parsedCheckout = parseTimeParts(conditionForm.checkout_time);
		const parsedDayCheckin = parseTimeParts(conditionForm.day_checkin_time);
		const parsedDayCheckout = parseTimeParts(conditionForm.day_checkout_time);
		const depositPercent = Number(String(conditionForm.deposit_percent ?? '').replace(',', '.'));

		if (!parsedCheckin || !parsedCheckout || !parsedDayCheckin || !parsedDayCheckout) {
			toast.error("Heure invalide");
			return;
		}
		if (!Number.isFinite(depositPercent) || depositPercent < 0 || depositPercent > 100) {
			toast.error("Pourcentage d'acompte invalide");
			return;
		}

		const hourlyPricesPayload = [];
		for (const type of roomTypes) {
			const key = normalizeRoomTypeKey(type);
			const rawValue = conditionForm.hourly_prices?.[key];
			const parsed = parseOptionalAmountInput(rawValue);
			if (!parsed.isValid) {
				toast.error(`Prix/heure invalide pour le type ${type}`);
				return;
			}
			hourlyPricesPayload.push({ type, prix_heure: parsed.value });
		}

		const dayPricesPayload = [];
		for (const type of roomTypes) {
			const key = normalizeRoomTypeKey(type);
			const rawValue = conditionForm.day_prices?.[key];
			const parsed = parseOptionalAmountInput(rawValue);
			if (!parsed.isValid) {
				toast.error(`Prix/journée invalide pour le type ${type}`);
				return;
			}
			dayPricesPayload.push({ type, prix_journee: parsed.value });
		}

		const nightlyPricesPayload = [];
		for (const type of roomTypes) {
			const key = normalizeRoomTypeKey(type);
			const rawValue = conditionForm.nightly_prices?.[key];
			const cleaned = String(rawValue ?? '').trim();
			if (!cleaned) continue;
			const parsed = parseAmountInput(cleaned);
			if (!parsed.isValid) {
				toast.error(`Prix/nuit invalide pour le type ${type}`);
				return;
			}
			nightlyPricesPayload.push({ type, prix_nuit: parsed.value });
		}

		try {
			setIsSubmitting(true);
			const payload = {
				checkin_time: conditionForm.checkin_time,
				checkout_time: conditionForm.checkout_time,
				day_checkin_time: conditionForm.day_checkin_time,
				day_checkout_time: conditionForm.day_checkout_time,
				cin_required_reservation: Boolean(conditionForm.cin_required_reservation),
				cin_required_occupation: Boolean(conditionForm.cin_required_occupation),
				deposit_percent: depositPercent,
				hourly_prices: hourlyPricesPayload,
				day_prices: dayPricesPayload,
				nightly_prices: nightlyPricesPayload
			};
			const response = await axios.put(API_URL + "/api/chambres/conditions", payload);
			if (response.status === 200 && response.data) {
				const hourlyPrices = {};
				const hourlyList = Array.isArray(response.data.hourly_prices) ? response.data.hourly_prices : [];
				hourlyList.forEach((entry) => {
					const key = normalizeRoomTypeKey(entry?.type);
					if (!key) return;
					const parsed = Number(String(entry?.prix_heure ?? '').replace(',', '.'));
					hourlyPrices[key] = Number.isFinite(parsed) ? parsed : 0;
				});
				const dayPrices = {};
				const dayList = Array.isArray(response.data.day_prices) ? response.data.day_prices : [];
				dayList.forEach((entry) => {
					const key = normalizeRoomTypeKey(entry?.type);
					if (!key) return;
					const parsed = Number(String(entry?.prix_journee ?? '').replace(',', '.'));
					dayPrices[key] = Number.isFinite(parsed) ? parsed : 0;
				});
				const nightlyPrices = {};
				const nightlyList = Array.isArray(response.data.nightly_prices) ? response.data.nightly_prices : [];
				nightlyList.forEach((entry) => {
					const key = normalizeRoomTypeKey(entry?.type);
					if (!key) return;
					const parsed = Number(String(entry?.prix_nuit ?? '').replace(',', '.'));
					nightlyPrices[key] = Number.isFinite(parsed) ? parsed : '';
				});
				const normalized = {
					checkin_time: response.data.checkin_time || DEFAULT_ROOM_CONDITION.checkin_time,
					checkout_time: response.data.checkout_time || DEFAULT_ROOM_CONDITION.checkout_time,
					day_checkin_time: response.data.day_checkin_time || DEFAULT_ROOM_CONDITION.day_checkin_time,
					day_checkout_time: response.data.day_checkout_time || DEFAULT_ROOM_CONDITION.day_checkout_time,
					cin_required_reservation: Boolean(response.data.cin_required_reservation),
					cin_required_occupation: Boolean(response.data.cin_required_occupation),
					deposit_percent: Number(response.data.deposit_percent) || 0,
					hourly_prices: hourlyPrices,
					day_prices: dayPrices,
					nightly_prices: nightlyPrices
				};
				setRoomCondition(normalized);
				setConditionForm(normalized);
				toast.success("Conditions mises à jour");
				closeConditionPopup(true);
				if (nightlyPricesPayload.length > 0) {
					await refreshCurrentTable();
				}
			}
		} catch (err) {
			toast.error("Erreur lors de la mise à jour des conditions");
			console.log(err);
		} finally {
			setIsSubmitting(false);
		}
	};

	const openCreatePopup = () => {
		setRoomPopupMode('create');
		setEditingRoomId(null);
		resetRoomForm();
		setIsRoomPopupOpen(true);
	};

	const openEditPopup = (roomRow) => {
		if (!roomRow?.id) {
			toast.error('Chambre introuvable');
			return;
		}

		setRoomPopupMode('edit');
		setEditingRoomId(Number(roomRow.id));
		setRoomNumero(String(roomRow.numero ?? ''));
		setRoomType(String(roomRow.type ?? 'Standard'));
		setRoomCapacite(String(roomRow.capacite ?? '1'));
		setRoomPrixNuit(String(roomRow.raw_prix_nuit ?? '0'));
		setRoomDescription(String(roomRow.description ?? ''));
		setIsRoomPopupOpen(true);
	};

	const openDeletePopup = (roomRow) => {
		if (!roomRow?.id) {
			toast.error('Chambre introuvable');
			return;
		}

		setDeleteRoomTarget({
			id: Number(roomRow.id),
			numero: String(roomRow.numero ?? '')
		});
		setIsDeletePopupOpen(true);
	};

	const prepareOccupancyFromRoom = (roomRow, forcedMode = null, forceNew = false) => {
		if (!roomRow?.id) {
			toast.error('Chambre introuvable');
			return false;
		}

		const statusKey = normalizeStatus(roomRow.statut_key);
		if (statusKey === 'maintenance') {
			toast.error('La chambre est en maintenance');
			return false;
		}

		if (forcedMode === 'reservation') {
			const startValue = resolveDateValue(roomRow.raw_date_debut);
			const now = new Date();
			if (startValue && now >= startValue) {
				toast.error('Modification impossible: la réservation est déjà en cours');
				return false;
			}
		}

		const effectivePrixNuit = Number(roomRow.raw_occupation_prix_nuit ?? roomRow.raw_prix_nuit) || 0;
		const occupationId = roomRow.occupation_id ? Number(roomRow.occupation_id) : null;
		const useExistingOccupancy = Boolean(occupationId) && (forcedMode || (!forceNew && statusKey === 'reservee'));
		resetOccupancyForm();
		setIsOccupancyConfirmOpen(false);
		setOccupancyTargetRoom({
			id: Number(roomRow.id),
			numero: String(roomRow.numero ?? ''),
			type: String(roomRow.type ?? ''),
			statusKey,
			occupationType: normalizeOccupationType(roomRow.occupation_key),
			type_sejour: normalizeStayType(roomRow.type_sejour),
			occupation_id: useExistingOccupancy ? occupationId : null,
			prix_nuit: effectivePrixNuit,
			prix_heure: Number(roomRow.raw_prix_heure) || 0,
			prix_journee: Number(roomRow.raw_prix_journee) || 0,
			montant_total: Number(roomRow.montant_total) || 0,
			montant_acompte: Number(roomRow.montant_acompte) || 0,
			raw_date_debut: useExistingOccupancy ? roomRow.raw_date_debut : null,
			raw_date_fin_prevue: useExistingOccupancy ? roomRow.raw_date_fin_prevue : null
		});

		const autoMode = forceNew
			? 'reservation'
			: (forcedMode || (statusKey === 'reservee' ? 'occupation' : 'reservation'));
		const resolvedStayType = normalizeStayType(roomRow.type_sejour);
		const initialStayType = forceNew ? 'nuit' : resolvedStayType;
		setOccupancyMode(autoMode);
		setLockOccupancyMode(Boolean(forcedMode) || (!forceNew && !forcedMode && statusKey === 'reservee'));
		if (!useExistingOccupancy) {
			setOccupancyStayType(initialStayType);
			const now = new Date();
			let startValue = now;
			if (autoMode === 'occupation' && initialStayType === 'nuit') {
				startValue = alignDateTimeToCondition(now, roomCondition.checkin_time) || now;
			}
			setOccupancyStart(toDateTimeLocal(startValue));
		}
		if (useExistingOccupancy) {
			setOccupancyClientId(roomRow.client_id ? String(roomRow.client_id) : '');
			setOccupancyName(String(roomRow.occupant_nom ?? roomRow.client ?? '').trim() === '-' ? '' : String(roomRow.occupant_nom ?? roomRow.client ?? '').trim());
			setOccupancyContact(String(roomRow.occupant_contact ?? '').trim());
			setOccupancyCin(String(roomRow.occupant_cin ?? roomRow.client_cin ?? '').trim());
			const startValue = resolveDateValue(roomRow.raw_date_debut) || new Date();
			let endValue = resolveDateValue(roomRow.raw_date_fin_prevue);
			if (!endValue) {
				if (resolvedStayType === 'journee') {
					endValue = alignDateTimeToCondition(startValue, roomCondition.day_checkout_time) || new Date(startValue);
				} else {
					const nextDay = new Date(startValue);
					nextDay.setDate(nextDay.getDate() + 1);
					endValue = alignDateTimeToCondition(nextDay, roomCondition.checkout_time) || nextDay;
				}
			}
			setOccupancyStayType(resolvedStayType);
			setOccupancyStart(toDateTimeLocal(startValue));
			setOccupancyEnd(endValue ? toDateTimeLocal(endValue) : "");
			setOccupancyNote(String(roomRow.occupation_note ?? ''));
		}

		return true;
	};

	const openOccupancyPopup = (roomRow, forcedMode = null, forceNew = false) => {
		if (!prepareOccupancyFromRoom(roomRow, forcedMode, forceNew)) return;
		setIsOccupancyPopupOpen(true);
	};

	const openCheckinConfirm = (roomRow) => {
		if (!prepareOccupancyFromRoom(roomRow, 'occupation')) return;
		setIsOccupancyPopupOpen(false);
		setIsOccupancyConfirmOpen(true);
	};

	const openReleasePopup = (roomRow, mode = 'checkout') => {
		if (!roomRow?.id) {
			toast.error('Chambre introuvable');
			return;
		}

		setReleaseTargetRoom({
			id: Number(roomRow.id),
			occupation_id: roomRow.occupation_id ? Number(roomRow.occupation_id) : null,
			numero: String(roomRow.numero ?? ""),
			statusKey: normalizeStatus(roomRow.statut_key),
			occupationType: normalizeOccupationType(roomRow.occupation_key),
			type_sejour: normalizeStayType(roomRow.type_sejour),
			prix_nuit: Number(roomRow.raw_occupation_prix_nuit ?? roomRow.raw_prix_nuit) || 0,
			prix_heure: Number(roomRow.raw_prix_heure) || 0,
			prix_journee: Number(roomRow.raw_prix_journee) || 0,
			montant_total: Number(roomRow.montant_total) || 0,
			montant_acompte: Number(roomRow.montant_acompte) || 0,
			raw_date_debut: roomRow.raw_date_debut,
			raw_date_fin_prevue: roomRow.raw_date_fin_prevue
		});
		setReleaseMode(mode);
		setReleaseNote('');
		setReleaseMontantInput('');
		setIsReleasePopupOpen(true);
	};

	const openPayNowPopup = (roomRow) => {
		if (!roomRow?.id || !roomRow?.occupation_id) {
			toast.error('Occupation introuvable');
			return;
		}

		setPayNowTargetRoom({
			id: Number(roomRow.id),
			occupation_id: roomRow.occupation_id ? Number(roomRow.occupation_id) : null,
			numero: String(roomRow.numero ?? ""),
			type_sejour: normalizeStayType(roomRow.type_sejour),
			prix_nuit: Number(roomRow.raw_occupation_prix_nuit ?? roomRow.raw_prix_nuit) || 0,
			prix_heure: Number(roomRow.raw_prix_heure) || 0,
			prix_journee: Number(roomRow.raw_prix_journee) || 0,
			montant_total: Number(roomRow.montant_total) || 0,
			montant_acompte: Number(roomRow.montant_acompte) || 0,
			raw_date_debut: roomRow.raw_date_debut,
			raw_date_fin_prevue: roomRow.raw_date_fin_prevue
		});
		setPayNowMontantInput('');
		setIsPayNowPopupOpen(true);
	};

	const closeRoomPopup = (force = false) => {
		if (isSubmitting && !force) return;
		setIsRoomPopupOpen(false);
		setRoomPopupMode('create');
		setEditingRoomId(null);
		resetRoomForm();
	};

	const closeDeletePopup = (force = false) => {
		if (isSubmitting && !force) return;
		setIsDeletePopupOpen(false);
		setDeleteRoomTarget(null);
	};

	const closeOccupancyPopup = (force = false) => {
		if (isSubmitting && !force) return;
		setIsOccupancyPopupOpen(false);
		setIsOccupancyConfirmOpen(false);
		setOccupancyTargetRoom(null);
		setIsDateTimePickerOpen(false);
		setDateTimePickerTarget(null);
		resetOccupancyForm();
	};

	const closeReleasePopup = (force = false) => {
		if (isSubmitting && !force) return;
		setIsReleasePopupOpen(false);
		setReleaseTargetRoom(null);
		setReleaseMode('checkout');
		setReleaseNote('');
		setReleaseMontantInput('');
	};

	const closePayNowPopup = (force = false) => {
		if (isSubmitting && !force) return;
		setIsPayNowPopupOpen(false);
		setPayNowTargetRoom(null);
		setPayNowMontantInput('');
	};

	const handleSubmitRoom = async () => {
		if (isSubmitting) return;

		const cleanedNumero = String(roomNumero ?? '').trim();
		const cleanedType = String(roomType ?? '').trim() || 'Standard';
		const cleanedCapacite = Number(String(roomCapacite ?? '').trim());
		let cleanedPrix = Number(String(roomPrixNuit ?? '').trim().replace(/\s/g, '').replace(',', '.'));
		const cleanedDescription = String(roomDescription ?? '').trim();
		if (roomPopupMode === 'create') {
			const key = normalizeRoomTypeKey(cleanedType);
			const rawConditionPrice = roomCondition.nightly_prices?.[key];
			const parsedConditionPrice = Number(String(rawConditionPrice ?? '').replace(',', '.'));
			if (Number.isFinite(parsedConditionPrice) && parsedConditionPrice > 0) {
				cleanedPrix = parsedConditionPrice;
			}
		}

		if (!cleanedNumero) {
			toast.error('Le numéro de chambre est obligatoire');
			return;
		}
		if (!Number.isInteger(cleanedCapacite) || cleanedCapacite <= 0) {
			toast.error('Capacité invalide');
			return;
		}
		if (!Number.isFinite(cleanedPrix) || cleanedPrix < 0) {
			toast.error('Prix/nuit invalide');
			return;
		}

		try {
			setIsSubmitting(true);
			const payload = {
				numero: cleanedNumero,
				type: cleanedType,
				capacite: cleanedCapacite,
				prix_nuit: cleanedPrix,
				description: cleanedDescription
			};

			if (roomPopupMode === 'edit') {
				if (!editingRoomId) {
					toast.error('Chambre introuvable');
					return;
				}
				const response = await axios.patch(`${API_URL}/api/chambres/${editingRoomId}`, payload);
				if (response.status === 200) {
					toast.success('Chambre modifiée');
					closeRoomPopup(true);
					await refreshCurrentTable();
				}
			} else {
				const response = await axios.post(`${API_URL}/api/chambres`, payload);
				if (response.status === 201) {
					toast.success('Chambre ajoutée');
					closeRoomPopup(true);
					await refreshCurrentTable();
				}
			}
		} catch (err) {
			if (err?.response?.status === 409) {
				toast.error('Ce numéro de chambre existe déjà');
			} else {
				toast.error('Impossible d\'enregistrer cette chambre');
			}
			console.log(err);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleConfirmDeleteRoom = async () => {
		if (isSubmitting || !deleteRoomTarget?.id) return;

		try {
			setIsSubmitting(true);
			const response = await axios.delete(`${API_URL}/api/chambres/${deleteRoomTarget.id}`);
			if (response.status === 200) {
				toast.success('Chambre supprimée');
				closeDeletePopup(true);
				await refreshCurrentTable();
			}
		} catch (err) {
			if (err?.response?.status === 409) {
				toast.error('Suppression impossible: chambre liée à des occupations');
			} else {
				toast.error('Erreur de suppression de chambre');
			}
			console.log(err);
		} finally {
			setIsSubmitting(false);
		}
	};

	const closeDepositPopup = (force = false) => {
		if (isSubmitting && !force) return;
		setIsDepositPopupOpen(false);
		setDepositInput('');
	};

	const closeOccupancyConfirm = (force = false) => {
		if (isSubmitting && !force) return;
		setIsOccupancyConfirmOpen(false);
	};

	const showOccupancyConflictToast = (err, fallbackMessage) => {
		if (err?.response?.status === 409) {
			const conflict = err?.response?.data?.conflict;
			if (conflict?.date_debut) {
				const conflictStart = formatDateTime(conflict.date_debut);
				if (conflictStart !== '-') {
					const conflictEnd = conflict.date_fin_prevue ? formatDateTime(conflict.date_fin_prevue) : '';
					const rangeLabel = conflictEnd && conflictEnd !== '-'
						? `${conflictStart} - ${conflictEnd}`
						: conflictStart;
					toast.error(`Occupe a ce moment: ${rangeLabel}`);
					return;
				}
			}
			toast.error(err?.response?.data?.error || 'Chambre indisponible');
			return;
		}
		toast.error(fallbackMessage || "Erreur lors de l'affectation");
	};

	const checkOccupancyAvailability = async () => {
		if (!occupancyTargetRoom?.id) return false;
		const stayType = normalizeStayType(occupancyStayType);
		const startDate = resolveDateValue(occupancyStart) || new Date();
		const endDate = occupancyEnd ? resolveDateValue(occupancyEnd) : null;
		const payload = {
			mode: occupancyMode,
			type_sejour: stayType,
			date_debut: startDate ? toDateTimeLocal(startDate) : null,
			date_fin_prevue: endDate ? toDateTimeLocal(endDate) : null,
			check_only: true
		};
		if (occupancyTargetRoom?.occupation_id) {
			payload.occupation_id = occupancyTargetRoom.occupation_id;
		}

		try {
			await axios.post(`${API_URL}/api/chambres/${occupancyTargetRoom.id}/occupations`, payload);
			return true;
		} catch (err) {
			showOccupancyConflictToast(err, 'Erreur de verification disponibilite');
			return false;
		}
	};

	useEffect(() => {
		if (!isOccupancyPopupOpen || !occupancyTargetRoom?.id) {
			setAvailabilityStatus('idle');
			setAvailabilityConflict(null);
			setAvailabilityMessage('');
			return undefined;
		}

		const stayType = normalizeStayType(occupancyStayType);
		const startDate = resolveDateValue(occupancyStart);
		const endDate = occupancyEnd ? resolveDateValue(occupancyEnd) : null;

		if (!startDate || !endDate) {
			setAvailabilityStatus('idle');
			setAvailabilityConflict(null);
			setAvailabilityMessage('');
			return undefined;
		}
		if (endDate && endDate < startDate) {
			setAvailabilityStatus('invalid');
			setAvailabilityConflict(null);
			setAvailabilityMessage('Dates invalides');
			return undefined;
		}

		if (availabilityDebounceRef.current) {
			clearTimeout(availabilityDebounceRef.current);
		}

		setAvailabilityStatus('checking');
		setAvailabilityConflict(null);
		setAvailabilityMessage('');

		availabilityDebounceRef.current = setTimeout(() => {
			const requestId = availabilityRequestRef.current + 1;
			availabilityRequestRef.current = requestId;

			const payload = {
				mode: occupancyMode,
				type_sejour: stayType,
				date_debut: startDate ? toDateTimeLocal(startDate) : null,
				date_fin_prevue: endDate ? toDateTimeLocal(endDate) : null,
				check_only: true
			};
			if (occupancyTargetRoom?.occupation_id) {
				payload.occupation_id = occupancyTargetRoom.occupation_id;
			}

			axios.post(`${API_URL}/api/chambres/${occupancyTargetRoom.id}/occupations`, payload)
				.then(() => {
					if (availabilityRequestRef.current !== requestId) return;
					setAvailabilityStatus('free');
					setAvailabilityConflict(null);
					setAvailabilityMessage('');
				})
				.catch((err) => {
					if (availabilityRequestRef.current !== requestId) return;
					if (err?.response?.status === 409) {
						setAvailabilityStatus('occupied');
						setAvailabilityConflict(err?.response?.data?.conflict || null);
						setAvailabilityMessage('');
						return;
					}
					if (err?.response?.status === 400) {
						setAvailabilityStatus('invalid');
						setAvailabilityConflict(null);
						setAvailabilityMessage(err?.response?.data?.error || 'Dates invalides');
						return;
					}
					setAvailabilityStatus('idle');
					setAvailabilityConflict(null);
					setAvailabilityMessage('');
				});
		}, 350);

		return () => {
			if (availabilityDebounceRef.current) {
				clearTimeout(availabilityDebounceRef.current);
			}
		};
	}, [
		isOccupancyPopupOpen,
		occupancyTargetRoom?.id,
		occupancyTargetRoom?.occupation_id,
		occupancyStart,
		occupancyEnd,
		occupancyMode,
		occupancyStayType,
		API_URL
	]);

	const handleSubmitOccupancy = async (montantAcompteOverride = null) => {
		if (isSubmitting || !occupancyTargetRoom?.id) return;

		const finalClientId = occupancyClientId ? Number(occupancyClientId) : null;
		const finalOccupantName = String(occupancyName ?? '').trim();
		const finalOccupantContact = String(occupancyContact ?? '').trim();
		let finalOccupantCin = String(occupancyCin ?? '').trim();
		const selectedClient = finalClientId
			? optionsClientSelect.find((entry) => Number(entry.id) === Number(finalClientId))
			: null;
		if (!finalOccupantCin && selectedClient?.cin) {
			finalOccupantCin = String(selectedClient.cin ?? '').trim();
		}

		if (!finalClientId && !finalOccupantName) {
			toast.error("Choisis un client ou renseigne le nom de l'occupant");
			return;
		}

		const requireCin = occupancyMode === 'reservation'
			? roomCondition.cin_required_reservation
			: roomCondition.cin_required_occupation;
		if (requireCin && !finalOccupantCin) {
			toast.error('Le CIN est obligatoire');
			return;
		}
		if (occupancyMode === 'reservation' && !occupancyEnd) {
			toast.error('Date de fin prévue obligatoire');
			return;
		}

		const stayType = normalizeStayType(occupancyStayType);
		const startDate = resolveDateValue(occupancyStart) || new Date();
		const endDate = occupancyEnd ? resolveDateValue(occupancyEnd) : null;

		if (isEditingReservation) {
			const now = new Date();
			if (startDate < now) {
				toast.error('Date de début déjà passée');
				return;
			}
			if (endDate && endDate <= now) {
				toast.error('Date de fin déjà passée');
				return;
			}
		}

		if (stayType === 'passage' && !endDate) {
			toast.error('Date de fin prévue obligatoire pour un passage');
			return;
		}
		if (stayType === 'journee' && !endDate) {
			toast.error('Date de fin prévue obligatoire pour une journée');
			return;
		}
		if (occupancyMode === 'reservation' && !endDate) {
			toast.error('Date de fin prévue obligatoire');
			return;
		}
		if (endDate) {
			if (stayType === 'journee') {
				if (endDate < startDate) {
					toast.error('La date de fin prévue doit être postérieure à la date de début');
					return;
				}
			} else if (endDate <= startDate) {
				toast.error('La date de fin prévue doit être postérieure à la date de début');
				return;
			}
		}
		if (stayType === 'nuit' && endDate && isSameCalendarDay(startDate, endDate)) {
			const startLabel = formatDateDisplay(startDate);
			const endLabel = formatDateDisplay(endDate);
			toast.error(`${startLabel} > ${endLabel} : choisissez Passage ou Journée.`);
			return;
		}
		const isCheckinConversion = occupancyMode === 'occupation'
			&& Boolean(occupancyTargetRoom?.occupation_id)
			&& normalizeStatus(occupancyTargetRoom?.statusKey) === 'reservee';
		if (stayType === 'journee' && endDate && occupancyMode === 'occupation' && !isSameCalendarDay(startDate, endDate) && !isCheckinConversion) {
			toast.error('Sélection multiple impossible en occupation. Choisissez Réservation.');
			return;
		}

		if (stayType === 'journee' && endDate) {
			const startMinutes = getMinutesFromDate(startDate);
			const endMinutes = getMinutesFromDate(endDate);
			const dayStartMinutes = getMinutesFromTimeValue(roomCondition.day_checkin_time);
			const dayEndMinutes = getMinutesFromTimeValue(roomCondition.day_checkout_time);
			const invalidJourneeTime = !Number.isFinite(startMinutes)
				|| !Number.isFinite(endMinutes)
				|| !Number.isFinite(dayStartMinutes)
				|| !Number.isFinite(dayEndMinutes)
				|| startMinutes >= endMinutes
				|| endMinutes <= dayStartMinutes
				|| startMinutes >= dayEndMinutes;
			if (invalidJourneeTime) {
				toast.error('Choisissez Nuit ou Passage');
				return;
			}
		}

		const alignedStart = stayType === 'nuit'
			? alignDateTimeToCondition(startDate, roomCondition.checkin_time)
			: null;
		const alignedEnd = endDate && stayType === 'nuit'
			? alignDateTimeToCondition(endDate, roomCondition.checkout_time)
			: null;
		if (stayType === 'nuit') {
			if (occupancyMode === 'reservation' && (!alignedEnd || (alignedStart && alignedEnd <= alignedStart))) {
				toast.error('La date de fin prévue doit être postérieure à la date de début');
				return;
			}
			if (occupancyMode === 'occupation' && alignedStart && alignedEnd && !isCheckinConversion) {
				const nightsCount = calculateNights(alignedStart, alignedEnd);
				if (nightsCount > 1) {
					toast.error('Sélection multiple impossible en occupation. Choisissez Réservation.');
					return;
				}
			}
		}
		if (stayType === 'passage') {
			const hourlyPrice = getHourlyPriceForType(occupancyTargetRoom?.type);
			if (!hourlyPrice || hourlyPrice <= 0) {
				toast.error('Prix/heure non défini pour ce type de chambre');
				return;
			}
		}
		if (stayType === 'journee') {
			const dayPrice = getDayPriceForType(occupancyTargetRoom?.type);
			if (!dayPrice || dayPrice <= 0) {
				toast.error('Prix/journée non défini pour ce type de chambre');
				return;
			}
		}

		try {
			setIsSubmitting(true);
			const journeeDays = stayType === 'journee' && endDate ? calculateDaysInclusive(startDate, endDate) : 0;
			const nuitNights = stayType === 'nuit' && alignedStart && alignedEnd
				? calculateNights(alignedStart, alignedEnd)
				: 0;
			const finalNote = String(occupancyNote ?? '').trim() || null;
			const payload = {
				mode: occupancyMode,
				type_sejour: stayType,
				client_id: finalClientId || null,
				occupant_nom: finalOccupantName,
				occupant_contact: finalOccupantContact,
				occupant_cin: finalOccupantCin,
				date_debut: startDate ? toDateTimeLocal(startDate) : null,
				date_fin_prevue: endDate ? toDateTimeLocal(endDate) : null,
				note: finalNote
			};
			if (occupancyMode === 'reservation' && occupancyTargetRoom?.occupation_id) {
				payload.occupation_id = occupancyTargetRoom.occupation_id;
			}
			if (occupancyMode === 'occupation' && occupancyTargetRoom?.occupation_id) {
				payload.occupation_id = occupancyTargetRoom.occupation_id;
			}
			if (occupancyMode === 'reservation') {
				payload.montant_acompte = montantAcompteOverride ?? 0;
			}
			const response = await axios.post(`${API_URL}/api/chambres/${occupancyTargetRoom.id}/occupations`, payload);

			if (response.status === 200 || response.status === 201) {
				toast.success(response.data?.message || 'Affectation enregistrée');
				closeOccupancyPopup(true);
				closeDepositPopup(true);
				await refreshCurrentTable();
			}
		} catch (err) {
			showOccupancyConflictToast(err, "Erreur lors de l'affectation");
			console.log(err);
		} finally {
			setIsSubmitting(false);
		}
	};

	const canOpenOccupancyConfirm = () => {
		const isCheckinConversion = occupancyMode === 'occupation'
			&& Boolean(occupancyTargetRoom?.occupation_id)
			&& normalizeStatus(occupancyTargetRoom?.statusKey) === 'reservee';
		if (isCheckinConversion) {
			const startDate = resolveDateValue(occupancyStart);
			const endDate = resolveDateValue(occupancyEnd);
			if (!startDate || !endDate) {
				toast.error('Date de debut/fin invalide');
				return false;
			}
			const now = new Date();
			if (now < startDate) {
				toast.error(`Check-in possible a partir de ${formatDateTimeDisplay(startDate)}`);
				return false;
			}
			if (now >= endDate) {
				toast.error('Reservation expirée (fin dépassée)');
				return false;
			}
		}
		if (occupancyMode !== 'reservation') {
			return true;
		}
		if (!occupancyEnd) {
			toast.error('Date de fin prévue obligatoire');
			return false;
		}
		if (reservationSummary.stayType === 'passage') {
			if (!reservationSummary.hours || reservationSummary.hours <= 0) {
				toast.error('Durée de passage invalide');
				return false;
			}
		} else if (reservationSummary.stayType === 'journee') {
			if (!reservationSummary.isJourneeTimeValid) {
				toast.error('Choisissez Nuit ou Passage');
				return false;
			}
			if (!reservationSummary.days || reservationSummary.days <= 0) {
				toast.error('La date de fin prévue doit être postérieure à la date de début');
				return false;
			}
		} else if (!reservationSummary.alignedEnd || !reservationSummary.alignedStart || reservationSummary.alignedEnd <= reservationSummary.alignedStart) {
			toast.error('La date de fin prévue doit être postérieure à la date de début');
			return false;
		}
		return true;
	};

	const handleConfirmOccupancy = () => {
		if (!canOpenOccupancyConfirm()) return;
		setIsOccupancyConfirmOpen(true);
	};

	const handleConfirmOccupancyYes = async () => {
		if (!canOpenOccupancyConfirm()) {
			setIsOccupancyConfirmOpen(false);
			return;
		}
		setIsOccupancyConfirmOpen(false);
		const isAvailable = await checkOccupancyAvailability();
		if (!isAvailable) return;
		if (occupancyMode !== 'reservation') {
			handleSubmitOccupancy();
			return;
		}
		const requiredDeposit = isEditingReservation ? requiredReservationDeposit : (reservationSummary.minDeposit ?? 0);
		if (!requiredDeposit || Number(requiredDeposit) <= 0) {
			handleSubmitOccupancy(0);
			return;
		}
		setDepositInput(String(requiredDeposit));
		setIsDepositPopupOpen(true);
	};

	const handleConfirmDeposit = () => {
		const parsed = parseAmountInput(depositInput);
		if (!parsed.isValid) {
			toast.error('Montant acompte invalide');
			return;
		}
		const requiredDeposit = isEditingReservation ? requiredReservationDeposit : (reservationSummary.minDeposit ?? 0);
		if (parsed.value < requiredDeposit) {
			toast.error(`Acompte minimum: ${formatNumberWithSpace(requiredDeposit)} Ar`);
			return;
		}
		setIsDepositPopupOpen(false);
		handleSubmitOccupancy(parsed.value);
	};

	const handleConfirmPayNow = async () => {
		if (isSubmitting || !payNowTargetRoom?.id || !payNowTargetRoom?.occupation_id) return;
		if (payNowIsPaid) {
			toast.error('Paiement déjà complet');
			return;
		}
		const parsed = parseAmountInput(payNowMontantInput);
		if (!parsed.isValid || parsed.value <= 0) {
			toast.error('Montant reçu invalide');
			return;
		}

		try {
			setIsSubmitting(true);
			const payload = {
				occupation_id: payNowTargetRoom.occupation_id,
				montant_recu: parsed.value
			};
			const response = await axios.patch(`${API_URL}/api/chambres/${payNowTargetRoom.id}/payment`, payload);
			if (response.status === 200) {
				toast.success(response.data?.message || 'Paiement enregistré');
				closePayNowPopup(true);
				await refreshCurrentTable();
			}
		} catch (err) {
			toast.error(err?.response?.data?.error || 'Erreur paiement');
			console.log(err);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleConfirmRelease = async () => {
		if (isSubmitting || !releaseTargetRoom?.id) return;
		let montantRecuValue = 0;
		if (releaseMode === 'checkout') {
			if (!releaseIsPaid) {
				const parsed = parseAmountInput(releaseMontantInput);
				if (!parsed.isValid) {
					toast.error('Montant reçu invalide');
					return;
				}
				montantRecuValue = parsed.value;
				if (montantRecuValue < releaseSummary.reste) {
					toast.error('Montant reçu insuffisant');
					return;
				}
			}
		}
		try {
			setIsSubmitting(true);
			const payload = {
				mode: releaseMode,
				note: releaseNote || null
			};
			if (releaseTargetRoom.occupation_id) {
				payload.occupation_id = releaseTargetRoom.occupation_id;
			}
			if (releaseMode === 'checkout') {
				payload.montant_recu = montantRecuValue;
			}
			const response = await axios.patch(`${API_URL}/api/chambres/${releaseTargetRoom.id}/release`, payload);
			if (response.status === 200) {
				toast.success(response.data?.message || 'Chambre libérée');
				closeReleasePopup(true);
				await refreshCurrentTable();
			}
		} catch (err) {
			toast.error(err?.response?.data?.error || 'Erreur de libération');
			console.log(err);
		} finally {
			setIsSubmitting(false);
		}
	};
	const handleSwitchRoomStatus = async (roomId, targetStatus) => {
		if (isSubmitting) return;
		if (!roomId || !targetStatus) return;

		try {
			setIsSubmitting(true);
			const response = await axios.patch(`${API_URL}/api/chambres/${roomId}/status`, {
				statut: targetStatus
			});
			if (response.status === 200) {
				toast.success(response.data?.message || 'Statut chambre mis à jour');
				await refreshCurrentTable();
			}
		} catch (err) {
			toast.error(err?.response?.data?.error || 'Erreur de changement de statut');
			console.log(err);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleRoomRowClick = (rowId) => {
		const target = roomRows.find((row) => Number(row.ID) === Number(rowId));
		if (!target) return;
		openActiveHistory(target);
	};

	const handleActiveDateSelect = (date) => {
		if (!date) return;
		setActiveHistoryDate(date);
		const monthStart = getMonthStart(date);
		setActiveHistoryMonth(monthStart);
	};

	const handleActiveMonthChange = (direction) => {
		if (activeCalendarView === 'year') {
			setActiveYearPageStart((prev) => prev + (direction * 12));
			return;
		}
		setActiveHistoryMonth((prev) => {
			const base = getMonthStart(prev);
			if (activeCalendarView === 'month') {
				base.setFullYear(base.getFullYear() + direction);
				return base;
			}
			base.setMonth(base.getMonth() + direction);
			return base;
		});
	};

	const handleActiveMonthSelect = (monthIndex) => {
		const base = getMonthStart(activeHistoryMonth);
		const next = new Date(base.getFullYear(), monthIndex, 1);
		setActiveHistoryMonth(next);
		setActiveCalendarView('day');
	};

	const handleActiveYearSelect = (year) => {
		const base = getMonthStart(activeHistoryMonth);
		const next = new Date(year, base.getMonth(), 1);
		setActiveHistoryMonth(next);
		setActiveCalendarView('month');
	};

	const handleClientSelectionChange = (event) => {
		const selectedId = String(event.target.value ?? '').trim();
		setOccupancyClientId(selectedId);
		if (!selectedId) return;

		const selectedClient = optionsClientSelect.find((entry) => String(entry.id) === selectedId);
		if (!selectedClient) return;

		if (!String(occupancyName ?? '').trim()) {
			setOccupancyName(selectedClient.name);
		}
		if (!String(occupancyContact ?? '').trim() && selectedClient.contact) {
			setOccupancyContact(selectedClient.contact);
		}
		if (!String(occupancyCin ?? '').trim() && selectedClient.cin) {
			setOccupancyCin(selectedClient.cin);
		}
	};

	const handleRefresh = async () => {
		await refreshCurrentTable({ includeAux: true });
	};

	const toggleHistoryView = () => {
		const nextParams = new URLSearchParams(searchParams);
		if (isHistoryView) {
			nextParams.delete("view");
		} else {
			nextParams.set("view", "history");
		}
		if (!isHistoryView && !activeHistoryRoom) {
			closeActiveHistory();
		}
		setSearchParams(nextParams, { replace: true });
		if (isHistoryView && activeHistoryRoom?.id) {
			loadActiveHistory(activeHistoryRoom.id);
		}
	};

	const isActiveHistoryView = Boolean(activeHistoryRoom);
	const refreshLabel = isHistoryView
		? (isHistoryLoading ? 'Actualisation...' : 'Actualiser')
		: (isActiveHistoryView
			? (isActiveHistoryLoading ? 'Actualisation...' : 'Actualiser')
			: (isTabLoading ? 'Actualisation...' : 'Actualiser'));

	if (isLoading) {
		return (
			<div style={{
				width: '100%',
				height: '91vh',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				backgroundColor: theme === 'light' ? 'var(--whiteBe)' : 'var(--darkBodyColor)'
			}}>
				<Loading />
			</div>
		);
	}

	return (
		<div className={`fournisseurPage ${(isRoomPopupOpen || isDeletePopupOpen || isOccupancyPopupOpen || isOccupancyConfirmOpen || isReleasePopupOpen || isPayNowPopupOpen || isConditionPopupOpen || isDepositPopupOpen || isTimePickerOpen || isDateTimePickerOpen || isHistoryDetailOpen || isActiveHistoryDetailOpen) ? 'popup-open' : ''}`}>
			<div className="rightPart supplier-main-content">
				<div className="findSection">
					<h4>
						{isHistoryView
							? 'Historique des chambres'
							: (isActiveHistoryView
								? `Chambre ${activeHistoryRoom?.numero || ''} - Occupations actives`
								: 'Gestion des chambres')}
					</h4>
					<section style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
						{!isHistoryView && !isActiveHistoryView && (
							<>
								<BasicButton
									variant={'outlined'}
									color={'var(--ThemClaire)'}
									colorH={'var(--white)'}
									bgColor={'transparent'}
									bgColorH={'var(--ThemClaire)'}
									bgColorA={'var(--ThemClaire)'}
									brdrColor={'var(--ThemClaire)'}
									brdrColorH={'var(--ThemClaire)'}
									textBtn={'Ajouter une chambre'}
									width={180}
									padding={'7.8px 0px 10px 0px'}
									onClick={openCreatePopup}
								/>
								<BasicButton
									variant={'outlined'}
									color={'var(--ThemClaire)'}
									colorH={'var(--white)'}
									bgColor={'transparent'}
									bgColorH={'var(--ThemClaire)'}
									bgColorA={'var(--ThemClaire)'}
									brdrColor={'var(--ThemClaire)'}
									brdrColorH={'var(--ThemClaire)'}
									textBtn={'Condition'}
									width={120}
									padding={'7.8px 0px 10px 0px'}
									onClick={openConditionPopup}
								/>
							</>
						)}
						{isActiveHistoryView && !isHistoryView && (
							<BasicButton
								variant={'outlined'}
								color={'var(--ThemClaire)'}
								colorH={'var(--white)'}
								bgColor={'transparent'}
								bgColorH={'var(--ThemClaire)'}
								bgColorA={'var(--ThemClaire)'}
								brdrColor={'var(--ThemClaire)'}
								brdrColorH={'var(--ThemClaire)'}
								textBtn={'Retour'}
								width={120}
								padding={'7.8px 0px 10px 0px'}
								onClick={closeActiveHistory}
							/>
						)}
						<BasicButton
							variant={'outlined'}
							color={'var(--ThemClaire)'}
							colorH={'var(--white)'}
							bgColor={'transparent'}
							bgColorH={'var(--ThemClaire)'}
							bgColorA={'var(--ThemClaire)'}
							brdrColor={'var(--ThemClaire)'}
							brdrColorH={'var(--ThemClaire)'}
							textBtn={isHistoryView ? 'Retour' : 'Historiques'}
							width={150}
							padding={'7.7px 0px 9px 0px'}
							onClick={toggleHistoryView}
						/>
						<BasicButton
							variant={'outlined'}
							color={'var(--ThemClaire)'}
							colorH={'var(--white)'}
							bgColor={'transparent'}
							bgColorH={'var(--ThemClaire)'}
							bgColorA={'var(--ThemClaire)'}
							brdrColor={'var(--ThemClaire)'}
							brdrColorH={'var(--ThemClaire)'}
							textBtn={refreshLabel}
							width={130}
							padding={'7.7px 0px 9px 0px'}
							onClick={handleRefresh}
						/>
						{isActiveHistoryView && !isHistoryView && (
							<>
								<div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
									<label className="supplier-popup-label">Occupation</label>
									<select
										className={`supplier-popup-select ${theme === 'light' ? 'light' : 'dark'}`}
										value={activeHistoryOccupationFilter}
										onChange={(event) => setActiveHistoryOccupationFilter(event.target.value)}
										disabled={isActiveHistoryLoading}
									>
										<option value="tout">Tout</option>
										<option value="reservation">Reservation</option>
										<option value="occupation">Occupation</option>
									</select>
								</div>
								<InputSearch
									value={activeHistorySearchValue}
									onChangeValue={setActiveHistorySearchValue}
									options={optionsActiveHistorySearch}
									label={'Client / Contact / CIN'}
									onKeyDown={handleActiveHistorySearchKeyDown}
								/>
								<BasicButton
									variant={'contained'}
									color={'var(--white)'}
									bgColor={'#f87269'}
									bgColorH={'#eb6258'}
									bgColorA={'#E42417'}
									brdrColor={'#f87269'}
									brdrColorH={'#eb6258'}
									textBtn={'Rechercher'}
									width={100}
									padding={'7.7px 0px 9px 0px'}
									onClick={() => applyActiveHistorySearchValue(activeHistorySearchValue)}
								/>
							</>
						)}
						{!isHistoryView && !isActiveHistoryView && (
							<>
								<InputSearch
									value={searchRoomValue}
									onChangeValue={setSearchRoomValue}
									options={optionsInputSearch}
									label={'Numero / Type / Client'}
									onKeyDown={handleSearchKeyDown}
								/>
								<BasicButton
									variant={'contained'}
									color={'var(--white)'}
									bgColor={'#f87269'}
									bgColorH={'#eb6258'}
									bgColorA={'#E42417'}
									brdrColor={'#f87269'}
									brdrColorH={'#eb6258'}
									textBtn={'Rechercher'}
									width={100}
									padding={'7.7px 0px 9px 0px'}
									onClick={applySearchValue}
								/>
							</>
						)}
						{isHistoryView && (
							<>
								<div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
									<label className="supplier-popup-label">Statut</label>
									<select
										className={`supplier-popup-select ${theme === 'light' ? 'light' : 'dark'}`}
										value={historyStatusFilter}
										onChange={(event) => setHistoryStatusFilter(event.target.value)}
										disabled={isHistoryLoading}
									>
										<option value="tout">Tout</option>
										<option value="annulee">Annulee</option>
										<option value="terminee">Terminee</option>
									</select>
								</div>
								<InputSearch
									value={historySearchValue}
									onChangeValue={setHistorySearchValue}
									options={optionsHistorySearch}
									label={'Numero / Type / Client'}
									onKeyDown={handleHistorySearchKeyDown}
								/>
								<BasicButton
									variant={'contained'}
									color={'var(--white)'}
									bgColor={'#f87269'}
									bgColorH={'#eb6258'}
									bgColorA={'#E42417'}
									brdrColor={'#f87269'}
									brdrColorH={'#eb6258'}
									textBtn={'Rechercher'}
									width={100}
									padding={'7.7px 0px 9px 0px'}
									onClick={applyHistorySearchValue}
								/>
							</>
						)}
					</section>
				</div>

				<div className="tableAff" style={{ overflow: 'hidden', marginTop: '15px' }}>
					{isHistoryView ? (
						<TableList
							TabLisHead={['ref|Ref', 'numero|N', 'Type', 'Client', 'Occupation', 'Statut', 'Debut', 'fin_reelle|Fin reel', 'acompte|Acompte', 'montant_recu|Total recu']}
							TabListBody={historyRows}
							createRow={createHistoryRow}
							isLoading={isHistoryLoading}
							onRowClick={openHistoryDetail}
							columnFlexOverrides={{
								ref: 0.4,
								numero: 0.55,
								type: 0.85,
								client: 1.35,
								occupation: 0.9,
								statut: 0.85,
								debut: 1.05,
								fin_reelle: 1.05,
								acompte: 0.9,
								montant_recu: 1
							}}
							columnMinWidthOverrides={{
								ref: 55,
								numero: 60,
								type: 110,
								client: 190,
								occupation: 110,
								statut: 100,
								debut: 140,
								fin_reelle: 140,
								acompte: 110,
								montant_recu: 130
							}}
						/>
					) : isActiveHistoryView ? (
						<div className="supplier-active-history-layout">
						<div className="supplier-active-history-table">
							{activeHistoryRows.length === 0 && !isActiveHistoryLoading ? (
								<div className="supplier-empty-state">Vide</div>
							) : (
								<TableList
									TabLisHead={['Client', 'contact|Contact', 'cin|CIN', 'Sejour', 'Occupation', 'Debut', 'fin_prevue|Fin prevue']}
									TabListBody={activeHistoryRows}
									createRow={createActiveHistoryRow}
									isLoading={isActiveHistoryLoading}
									onRowClick={openActiveHistoryDetail}
									columnFlexOverrides={{
										client: 1.3,
										contact: 1,
										cin: 0.9,
										sejour: 0.85,
										occupation: 0.9,
										debut: 1.05,
										fin_prevue: 1.05
									}}
									columnMinWidthOverrides={{
										client: 190,
										contact: 140,
										cin: 120,
										sejour: 110,
										occupation: 110,
										debut: 140,
										fin_prevue: 140
									}}
									actionColumn={{
										headerName: 'Action',
										field: 'action',
										flex: 1.2,
										minWidth: 380,
										renderCell: (params) => {
											const entry = activeHistoryRecordById.get(Number(params.row.id));
											if (!entry) return null;
											const occupationType = normalizeOccupationType(entry.type_occupation);
											const disableActions = Boolean(isSubmitting);
											const actionRoom = buildActiveHistoryActionRow(entry);
											if (!actionRoom?.id) return null;
											const totalDue = Number(entry.montant_total) || 0;
											const alreadyPaid = totalDue > 0 && Number(entry.montant_acompte) >= totalDue;

											return (
												<div className="supplier-row-actions supplier-room-actions">
													<div className="supplier-room-action-group">
														{occupationType === 'reservation' && (
															<>
																<Button
																	size="small"
																	variant="contained"
																	disabled={disableActions}
																	onClick={(event) => {
																		event.stopPropagation();
																		openCheckinConfirm(actionRoom);
																	}}
																	sx={{
																		textTransform: 'none',
																		fontFamily: 'poppins',
																		fontSize: '12px',
																		minWidth: 84,
																		height: 30,
																		backgroundColor: 'var(--ThemClaire)',
																		'&:hover': { backgroundColor: 'var(--ThemDur)' }
																		}}
																>
																	Check-in
																</Button>
																<Button
																	size="small"
																	variant="outlined"
																	disabled={disableActions}
																	onClick={(event) => {
																		event.stopPropagation();
																		openReleasePopup(actionRoom, 'cancel');
																	}}
																	sx={{
																		textTransform: 'none',
																		fontFamily: 'poppins',
																		fontSize: '12px',
																		minWidth: 74,
																		height: 30,
																		borderColor: '#f87269',
																		color: '#f87269',
																		'&:hover': {
																			borderColor: '#eb6258',
																			backgroundColor: 'rgba(248, 114, 105, 0.12)'
																		}
																	}}
																>
																	Annuler
																</Button>
																<Button
																	size="small"
																	variant="outlined"
																	disabled={disableActions}
																	onClick={(event) => {
																		event.stopPropagation();
																		openOccupancyPopup(actionRoom, 'reservation');
																	}}
																	sx={{
																		textTransform: 'none',
																		fontFamily: 'poppins',
																		fontSize: '12px',
																		minWidth: 82,
																		height: 30,
																		borderColor: 'var(--ThemClaire)',
																		color: 'var(--ThemClaire)',
																		'&:hover': {
																			borderColor: 'var(--ThemDur)',
																			backgroundColor: 'rgba(248, 114, 105, 0.12)'
																		}
																	}}
																>
																	Modifier
																</Button>
															</>
														)}
														{occupationType === 'occupation' && (
															<>
																<Button
																	size="small"
																	variant="outlined"
																	disabled={disableActions || alreadyPaid}
																	onClick={(event) => {
																		event.stopPropagation();
																		openPayNowPopup(actionRoom);
																	}}
																	sx={{
																		textTransform: 'none',
																		fontFamily: 'poppins',
																		fontSize: '12px',
																		minWidth: 118,
																		height: 30,
																		borderColor: 'var(--ThemClaire)',
																		color: 'var(--ThemClaire)',
																		'&:hover': {
																			borderColor: 'var(--ThemDur)',
																			backgroundColor: 'rgba(248, 114, 105, 0.12)'
																		}
																	}}
																>
																	Payer maintenant
																</Button>
																<Button
																	size="small"
																	variant="contained"
																	disabled={disableActions}
																	onClick={(event) => {
																		event.stopPropagation();
																		openReleasePopup(actionRoom, 'checkout');
																	}}
																	sx={{
																		textTransform: 'none',
																		fontFamily: 'poppins',
																		fontSize: '12px',
																		minWidth: 86,
																		height: 30,
																		backgroundColor: '#f87269',
																		'&:hover': { backgroundColor: '#eb6258' }
																	}}
																>
																	Liberer
																</Button>
															</>
														)}
													</div>
												</div>
											);
										}
									}}
								/>
							)}
						</div>
							<div className="supplier-active-history-calendar">
								<div className={`supplier-calendar ${theme === 'light' ? 'light' : 'dark'}`}>
									<div className="supplier-calendar-header">
										<button
											type="button"
											className="supplier-calendar-nav"
											onClick={() => handleActiveMonthChange(-1)}
										>
											‹
										</button>
										<div className="supplier-calendar-title">
											{activeCalendarView === 'year' ? (
												<button
													type="button"
													className="supplier-calendar-title-btn"
													onClick={() => setActiveCalendarView('month')}
												>
													{activeYearRangeLabel}
												</button>
											) : (
												<>
													<button
														type="button"
														className="supplier-calendar-title-btn"
														onClick={() => setActiveCalendarView('month')}
													>
														{activeMonthLabel}
													</button>
													<button
														type="button"
														className="supplier-calendar-title-btn"
														onClick={() => setActiveCalendarView('year')}
													>
														{activeYearValue}
													</button>
												</>
											)}
										</div>
										<button
											type="button"
											className="supplier-calendar-nav"
											onClick={() => handleActiveMonthChange(1)}
										>
											›
										</button>
									</div>
									{activeCalendarView === 'day' && (
										<>
											<div className="supplier-calendar-weekdays">
												{['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((label, index) => (
													<div key={`${label}-${index}`} className="supplier-calendar-weekday">{label}</div>
												))}
											</div>
											<div className="supplier-calendar-grid">
												{activeCalendarWeeks.map((week, weekIndex) => (
													week.map((day) => {
														const isSelected = isSameCalendarDay(day.date, activeHistoryDate);
														const isToday = isSameCalendarDay(day.date, new Date());
														return (
															<button
																key={`${weekIndex}-${day.date.toISOString()}`}
																type="button"
																className={[
																	'supplier-calendar-day',
																	day.inMonth ? '' : 'is-outside',
																	isSelected ? 'is-selected' : '',
																	isToday ? 'is-today' : ''
																].join(' ').trim()}
																onClick={() => handleActiveDateSelect(day.date)}
															>
																{day.date.getDate()}
															</button>
														);
													})
												))}
											</div>
										</>
									)}
									{activeCalendarView === 'month' && (
										<div className="supplier-calendar-month-grid">
											{MONTH_LABELS.map((label, index) => {
												const isSelected = index === getMonthStart(activeHistoryMonth).getMonth();
												return (
													<button
														key={label}
														type="button"
														className={[
															'supplier-calendar-month',
															isSelected ? 'is-selected' : ''
														].join(' ').trim()}
														onClick={() => handleActiveMonthSelect(index)}
													>
														{label}
													</button>
												);
											})}
										</div>
									)}
									{activeCalendarView === 'year' && (
										<div className="supplier-calendar-year-grid">
											{Array.from({ length: 12 }, (_, index) => activeYearPageStart + index).map((year) => {
												const isSelected = year === activeYearValue;
												return (
													<button
														key={year}
														type="button"
														className={[
															'supplier-calendar-year',
															isSelected ? 'is-selected' : ''
														].join(' ').trim()}
														onClick={() => handleActiveYearSelect(year)}
													>
														{year}
													</button>
												);
											})}
										</div>
									)}
								</div>
								{activeHistorySummary && (
									<div className={`supplier-active-history-summary ${theme === 'light' ? 'light' : 'dark'}`}>
										<div className="supplier-active-history-summary-row">
											<span className="supplier-active-history-label">N°</span>
											<span className="supplier-active-history-value">{activeHistorySummary.numero}</span>
										</div>
										<div className="supplier-active-history-summary-row">
											<span className="supplier-active-history-label">Type</span>
											<span className="supplier-active-history-value">{activeHistorySummary.type}</span>
										</div>
										<div className="supplier-active-history-summary-row">
											<span className="supplier-active-history-label">Statut</span>
											<span className="supplier-active-history-value">{activeHistorySummary.statut}</span>
										</div>
									</div>
								)}
							</div>
						</div>
					) : (
						<TableList
							TabLisHead={[
								'Numero',
								'Type',
								'Capacite',
								'Prix_nuit|Prix nuit',
								'Prix_journee|Prix journée',
								'Prix_heure|Prix heure',
								'Statut'
							]}
							onRowClick={handleRoomRowClick}
							TabListBody={roomRows}
							createRow={createRow}
							isLoading={isTabLoading}
							columnFlexOverrides={{
								numero: 0.8,
								type: 0.95,
								capacite: 0.65,
								prix_nuit: 0.9,
								prix_journee: 0.95,
								prix_heure: 0.85,
								statut: 0.9
							}}
							columnMinWidthOverrides={{
								numero: 100,
								type: 120,
								capacite: 95,
								prix_nuit: 120,
								prix_journee: 130,
								prix_heure: 120,
								statut: 110
							}}
							actionColumn={{
								headerName: 'Action',
								field: 'action',
								flex: 2.1,
								minWidth: 340,
								renderCell: (params) => {
									const statusKey = normalizeStatus(params.row.statut_key);
									const disableActions = Boolean(isSubmitting);

									return (
										<div className="supplier-row-actions supplier-room-actions">
											<div className="supplier-room-action-group">
												<Button
													size="small"
													variant="outlined"
													disabled={disableActions}
													onClick={(event) => {
														event.stopPropagation();
														openOccupancyPopup(params.row, null, true);
													}}
													sx={{
														textTransform: 'none',
														fontFamily: 'poppins',
														fontSize: '12px',
														minWidth: 86,
														height: 30,
														borderColor: 'var(--ThemClaire)',
														color: 'var(--ThemClaire)',
														'&:hover': {
															borderColor: 'var(--ThemClaire)',
															backgroundColor: 'rgba(248, 114, 105, 0.12)'
														}
													}}
												>
													Prendre
												</Button>
												{statusKey === 'maintenance' ? (
													<Button
														size="small"
														variant="outlined"
														disabled={disableActions}
														onClick={(event) => {
															event.stopPropagation();
															handleSwitchRoomStatus(params.row.id, 'libre');
														}}
														sx={{
															textTransform: 'none',
															fontFamily: 'poppins',
															fontSize: '12px',
															minWidth: 94,
															height: 30,
															borderColor: 'var(--ThemClaire)',
															color: 'var(--ThemClaire)',
															'&:hover': {
																borderColor: 'var(--ThemClaire)',
																backgroundColor: 'rgba(248, 114, 105, 0.12)'
															}
														}}
													>
														Rendre libre
													</Button>
												) : (
													<Button
														size="small"
														variant="outlined"
														disabled={disableActions}
														onClick={(event) => {
															event.stopPropagation();
															handleSwitchRoomStatus(params.row.id, 'maintenance');
														}}
														sx={{
															textTransform: 'none',
															fontFamily: 'poppins',
															fontSize: '12px',
															minWidth: 94,
															height: 30,
															borderColor: theme === 'light' ? 'var(--noirbeBorder)' : 'var(--whiteTransp)',
															color: theme === 'light' ? 'var(--noirbe)' : 'var(--whiteBe)',
															'&:hover': {
																borderColor: theme === 'light' ? 'var(--noirbeBorder)' : 'var(--whiteTransp)',
																backgroundColor: theme === 'light' ? 'rgba(29,29,29,0.08)' : 'rgba(255,255,255,0.08)'
															}
														}}
													>
														Maintenance
													</Button>
												)}
											</div>
											<IconButton
												size="small"
												disabled={disableActions}
												onClick={(event) => {
													event.stopPropagation();
													openEditPopup(params.row);
												}}
												sx={{
													color: theme === 'light' ? 'var(--noirbe)' : 'var(--whiteBe)',
													borderRadius: '8px',
													transition: 'all 0.2s ease',
													'&:hover': {
														backgroundColor: theme === 'light' ? 'rgba(29, 29, 29, 0.12)' : 'rgba(237, 241, 244, 0.14)',
														color: theme === 'light' ? 'var(--noirbe)' : 'var(--white)'
													}
												}}
											>
												<EditIco sx={{ width: 20, height: 20 }} />
											</IconButton>
											<IconButton
												size="small"
												disabled={disableActions}
												onClick={(event) => {
													event.stopPropagation();
													openDeletePopup(params.row);
												}}
												sx={{
													color: 'var(--ThemClaire)',
													borderRadius: '8px',
													transition: 'all 0.2s ease',
													'&:hover': {
														backgroundColor: 'rgba(248, 114, 105, 0.16)',
														color: 'var(--ThemDur)'
													}
												}}
											>
												<DeleteIco sx={{ width: 20, height: 20 }} />
											</IconButton>
										</div>
									);
								}
							}}
						/>
					)}
				</div>
			</div>

			{isRoomPopupOpen && (
				<div className="supplier-popup-overlay" onClick={(event) => {
					if (event.target === event.currentTarget) closeRoomPopup();
				}}>
					<div
						className="supplier-popup-content"
						style={{
							backgroundColor: theme === 'light' ? 'var(--whiteBeMax)' : 'var(--noirbe)',
							boxShadow: theme === 'light' ? '0 10px 30px rgba(0,0,0,0.18)' : '0 10px 30px rgba(0,0,0,0.4)'
						}}
						onClick={(event) => event.stopPropagation()}
					>
						<div className="supplier-popup-header">
							<h3>{roomPopupMode === 'edit' ? 'Modifier la chambre' : 'Ajouter une chambre'}</h3>
						</div>

						<div className="supplier-popup-form">
							<div className="supplier-popup-field">
								<TextField Width={'100%'} Placeholder={'Numero'} value={roomNumero} onChangeValue={setRoomNumero} />
							</div>
							<div className="supplier-popup-field">
								<TextField Width={'100%'} Placeholder={'Type'} value={roomType} onChangeValue={setRoomType} />
							</div>
							<div className="supplier-popup-field">
								<TextField Width={'100%'} Placeholder={'Capacite'} value={roomCapacite} onChangeValue={setRoomCapacite} />
							</div>
							<div className="supplier-popup-field">
								<TextField Width={'100%'} Placeholder={'Description (optionnel)'} value={roomDescription} onChangeValue={setRoomDescription} />
							</div>
						</div>

						<div className="supplier-popup-actions">
							<BasicButton
								variant={'outlined'}
								color={'var(--ThemClaire)'}
								colorH={'var(--white)'}
								bgColor={'transparent'}
								bgColorH={'var(--ThemClaire)'}
								bgColorA={'var(--ThemClaire)'}
								brdrColor={'var(--ThemClaire)'}
								brdrColorH={'var(--ThemClaire)'}
								textBtn={'Retour'}
								width={110}
								padding={'7.7px 0px 9px 0px'}
								onClick={closeRoomPopup}
							/>
							<BasicButton
								variant={'contained'}
								color={'var(--white)'}
								bgColor={'#f87269'}
								bgColorH={'#eb6258'}
								bgColorA={'#E42417'}
								brdrColor={'#f87269'}
								brdrColorH={'#eb6258'}
								textBtn={
									isSubmitting
										? (roomPopupMode === 'edit' ? 'Modification...' : 'Ajout...')
										: (roomPopupMode === 'edit' ? 'Modifier' : 'Ajouter')
								}
								width={110}
								padding={'7.7px 0px 9px 0px'}
								onClick={handleSubmitRoom}
							/>
						</div>
					</div>
				</div>
			)}


		{isConditionPopupOpen && (
			<div className="supplier-popup-overlay" onClick={(event) => {
				if (event.target === event.currentTarget) closeConditionPopup();
			}}>
				<div
					className="supplier-popup-content"
					style={{
						backgroundColor: theme === 'light' ? 'var(--whiteBeMax)' : 'var(--noirbe)',
						boxShadow: theme === 'light' ? '0 10px 30px rgba(0,0,0,0.18)' : '0 10px 30px rgba(0,0,0,0.4)'
					}}
					onClick={(event) => event.stopPropagation()}
				>
					<div className="supplier-popup-header">
						<h3>Conditions des chambres</h3>
					</div>

					<div className="supplier-popup-form">
						<div className="supplier-popup-time-grid">
							<div className="supplier-popup-time-block">
								<div className="supplier-popup-section-label">Nuit</div>
								<div className="supplier-popup-field">
									<label className="supplier-popup-label">Heure d'entrée</label>
									<input
										type="text"
										className={`supplier-popup-select supplier-popup-input ${theme === 'light' ? 'light' : 'dark'}`}
										value={conditionForm.checkin_time}
										readOnly
										onClick={() => openTimePicker('checkin')}
										onFocus={() => openTimePicker('checkin')}
										onKeyDown={(event) => event.preventDefault()}
										disabled={isSubmitting}
									/>
								</div>
								<div className="supplier-popup-field">
									<label className="supplier-popup-label">Heure de sortie</label>
									<input
										type="text"
										className={`supplier-popup-select supplier-popup-input ${theme === 'light' ? 'light' : 'dark'}`}
										value={conditionForm.checkout_time}
										readOnly
										onClick={() => openTimePicker('checkout')}
										onFocus={() => openTimePicker('checkout')}
										onKeyDown={(event) => event.preventDefault()}
										disabled={isSubmitting}
									/>
								</div>
							</div>
							<div className="supplier-popup-time-block">
								<div className="supplier-popup-section-label">Journée</div>
								<div className="supplier-popup-field">
									<label className="supplier-popup-label">Heure d'entrée</label>
									<input
										type="text"
										className={`supplier-popup-select supplier-popup-input ${theme === 'light' ? 'light' : 'dark'}`}
										value={conditionForm.day_checkin_time}
										readOnly
										onClick={() => openTimePicker('day_checkin')}
										onFocus={() => openTimePicker('day_checkin')}
										onKeyDown={(event) => event.preventDefault()}
										disabled={isSubmitting}
									/>
								</div>
								<div className="supplier-popup-field">
									<label className="supplier-popup-label">Heure de sortie</label>
									<input
										type="text"
										className={`supplier-popup-select supplier-popup-input ${theme === 'light' ? 'light' : 'dark'}`}
										value={conditionForm.day_checkout_time}
										readOnly
										onClick={() => openTimePicker('day_checkout')}
										onFocus={() => openTimePicker('day_checkout')}
										onKeyDown={(event) => event.preventDefault()}
										disabled={isSubmitting}
									/>
								</div>
							</div>
						</div>
						<div className="supplier-popup-field" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
							<input
								type="checkbox"
								checked={Boolean(conditionForm.cin_required_reservation)}
								onChange={(event) => setConditionForm((prev) => ({ ...prev, cin_required_reservation: event.target.checked }))}
								disabled={isSubmitting}
							/>
							<label className="supplier-popup-label" style={{ marginBottom: 0 }}>CIN requis pour reservation</label>
						</div>
						<div className="supplier-popup-field" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
							<input
								type="checkbox"
								checked={Boolean(conditionForm.cin_required_occupation)}
								onChange={(event) => setConditionForm((prev) => ({ ...prev, cin_required_occupation: event.target.checked }))}
								disabled={isSubmitting}
							/>
							<label className="supplier-popup-label" style={{ marginBottom: 0 }}>CIN requis pour occupation</label>
						</div>
						<div className="supplier-popup-field">
							<TextField
								Width={'100%'}
								Placeholder={'Acompte (%)'}
								value={String(conditionForm.deposit_percent ?? '')}
								onChangeValue={(value) => setConditionForm((prev) => ({ ...prev, deposit_percent: value }))}
								disabled={isSubmitting}
							/>
						</div>
						<div className="supplier-popup-field">
							<label className="supplier-popup-label">Prix par nuit (par type)</label>
							{roomTypes.length === 0 ? (
								<div className="supplier-popup-helper">Aucun type de chambre disponible.</div>
							) : (
								<div className="supplier-popup-hourly-list">
									<div className="supplier-popup-hourly-row">
										<select
											className={`supplier-popup-select supplier-popup-select--compact ${theme === 'light' ? 'light' : 'dark'}`}
											value={nightlyTypeSelection}
											onChange={(event) => setNightlyTypeSelection(event.target.value)}
											disabled={isSubmitting}
										>
											<option value="" disabled>Choisir un type</option>
											{roomTypes.map((type) => (
												<option key={type} value={type}>{type}</option>
											))}
										</select>
										<input
											type="text"
											className={`supplier-popup-select supplier-popup-input ${theme === 'light' ? 'light' : 'dark'}`}
											placeholder="Prix/nuit (Ar)"
											value={selectedNightlyValue}
											onChange={(event) => {
												if (!selectedNightlyKey) return;
												const nextValue = event.target.value;
												setConditionForm((prev) => ({
													...prev,
													nightly_prices: {
														...(prev.nightly_prices || {}),
														[selectedNightlyKey]: nextValue
													}
												}));
											}}
											disabled={isSubmitting || !selectedNightlyKey}
										/>
									</div>
								</div>
							)}
						</div>
						<div className="supplier-popup-field">
							<label className="supplier-popup-label">Prix par journée (par type)</label>
							{roomTypes.length === 0 ? (
								<div className="supplier-popup-helper">Aucun type de chambre disponible.</div>
							) : (
								<div className="supplier-popup-hourly-list">
									<div className="supplier-popup-hourly-row">
										<select
											className={`supplier-popup-select supplier-popup-select--compact ${theme === 'light' ? 'light' : 'dark'}`}
											value={dayTypeSelection}
											onChange={(event) => setDayTypeSelection(event.target.value)}
											disabled={isSubmitting}
										>
											<option value="" disabled>Choisir un type</option>
											{roomTypes.map((type) => (
												<option key={type} value={type}>{type}</option>
											))}
										</select>
										<input
											type="text"
											className={`supplier-popup-select supplier-popup-input ${theme === 'light' ? 'light' : 'dark'}`}
											placeholder="Prix/journée (Ar)"
											value={selectedDayValue}
											onChange={(event) => {
												if (!selectedDayKey) return;
												const nextValue = event.target.value;
												setConditionForm((prev) => ({
													...prev,
													day_prices: {
														...(prev.day_prices || {}),
														[selectedDayKey]: nextValue
													}
												}));
											}}
											disabled={isSubmitting || !selectedDayKey}
										/>
									</div>
								</div>
							)}
						</div>
						<div className="supplier-popup-field">
							<label className="supplier-popup-label">Prix par heure (passage)</label>
							{roomTypes.length === 0 ? (
								<div className="supplier-popup-helper">Aucun type de chambre disponible.</div>
							) : (
								<div className="supplier-popup-hourly-list">
									<div className="supplier-popup-hourly-row">
										<select
											className={`supplier-popup-select supplier-popup-select--compact ${theme === 'light' ? 'light' : 'dark'}`}
											value={hourlyTypeSelection}
											onChange={(event) => setHourlyTypeSelection(event.target.value)}
											disabled={isSubmitting}
										>
											<option value="" disabled>Choisir un type</option>
											{roomTypes.map((type) => (
												<option key={type} value={type}>{type}</option>
											))}
										</select>
										<input
											type="text"
											className={`supplier-popup-select supplier-popup-input ${theme === 'light' ? 'light' : 'dark'}`}
											placeholder="Prix/heure (Ar)"
											value={selectedHourlyValue}
											onChange={(event) => {
												if (!selectedHourlyKey) return;
												const nextValue = event.target.value;
												setConditionForm((prev) => ({
													...prev,
													hourly_prices: {
														...(prev.hourly_prices || {}),
														[selectedHourlyKey]: nextValue
													}
												}));
											}}
											disabled={isSubmitting || !selectedHourlyKey}
										/>
									</div>
								</div>
							)}
						</div>
					</div>

					<div className="supplier-popup-actions">
						<BasicButton
							variant={'outlined'}
							color={'var(--ThemClaire)'}
							colorH={'var(--white)'}
							bgColor={'transparent'}
							bgColorH={'var(--ThemClaire)'}
							bgColorA={'var(--ThemClaire)'}
							brdrColor={'var(--ThemClaire)'}
							brdrColorH={'var(--ThemClaire)'}
							textBtn={'Annuler'}
							width={110}
							padding={'7.7px 0px 9px 0px'}
							onClick={closeConditionPopup}
						/>
						<BasicButton
							variant={'contained'}
							color={'var(--white)'}
							bgColor={'#f87269'}
							bgColorH={'#eb6258'}
							bgColorA={'#E42417'}
							brdrColor={'#f87269'}
							brdrColorH={'#eb6258'}
							textBtn={isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
							width={130}
							padding={'7.7px 0px 9px 0px'}
							onClick={handleSaveCondition}
						/>
					</div>
				</div>
			</div>
		)}
		{isTimePickerOpen && (
			<div
				className="supplier-popup-overlay"
				style={{ zIndex: 70, backgroundColor: 'rgba(0, 0, 0, 0.2)' }}
				onClick={(event) => {
					if (event.target === event.currentTarget) closeTimePicker();
				}}
			>
				<div
					className="supplier-popup-content supplier-delete-popup"
					style={{
						backgroundColor: theme === 'light' ? 'var(--whiteBeMax)' : 'var(--noirbe)',
						boxShadow: theme === 'light' ? '0 10px 30px rgba(0,0,0,0.18)' : '0 10px 30px rgba(0,0,0,0.4)',
						maxHeight: '80vh',
						overflowY: 'auto'
					}}
					onClick={(event) => event.stopPropagation()}
				>
					<div className="supplier-popup-header">
						<h3>Choisir l'heure</h3>
					</div>

					<div className="supplier-popup-form" style={{ marginTop: '16px' }}>
						<div className="supplier-popup-field" style={{ display: 'flex', gap: '12px' }}>
							<div style={{ flex: 1 }}>
								<label className="supplier-popup-label">Heure (24h)</label>
								<select
									className={`supplier-popup-select supplier-popup-select--compact ${theme === 'light' ? 'light' : 'dark'}`}
									value={timePickerHour}
									onChange={(event) => setTimePickerHour(event.target.value)}
									disabled={isSubmitting}
								>
									{Array.from({ length: 24 }, (_, index) => {
										const value = String(index).padStart(2, '0');
										return (
											<option key={value} value={value}>{value}</option>
										);
									})}
								</select>
							</div>
							<div style={{ flex: 1 }}>
								<label className="supplier-popup-label">Minute</label>
								<select
									className={`supplier-popup-select supplier-popup-select--compact ${theme === 'light' ? 'light' : 'dark'}`}
									value={timePickerMinute}
									onChange={(event) => setTimePickerMinute(event.target.value)}
									disabled={isSubmitting}
								>
									{Array.from({ length: 60 }, (_, index) => {
										const value = String(index).padStart(2, '0');
										return (
											<option key={value} value={value}>{value}</option>
										);
									})}
								</select>
							</div>
						</div>
					</div>

					<div className="supplier-popup-actions">
						<BasicButton
							variant={'outlined'}
							color={'var(--ThemClaire)'}
							colorH={'var(--white)'}
							bgColor={'transparent'}
							bgColorH={'var(--ThemClaire)'}
							bgColorA={'var(--ThemClaire)'}
							brdrColor={'var(--ThemClaire)'}
							brdrColorH={'var(--ThemClaire)'}
							textBtn={'Annuler'}
							width={110}
							padding={'7.7px 0px 9px 0px'}
							onClick={closeTimePicker}
						/>
						<BasicButton
							variant={'contained'}
							color={'var(--white)'}
							bgColor={'#f87269'}
							bgColorH={'#eb6258'}
							bgColorA={'#E42417'}
							brdrColor={'#f87269'}
							brdrColorH={'#eb6258'}
							textBtn={'Valider'}
							width={110}
							padding={'7.7px 0px 9px 0px'}
							onClick={confirmTimePicker}
						/>
					</div>
				</div>
			</div>
		)}
		{isDateTimePickerOpen && (
			<div
				className="supplier-popup-overlay"
				style={{ zIndex: 70, backgroundColor: 'rgba(0, 0, 0, 0.2)' }}
				onClick={(event) => {
					if (event.target === event.currentTarget) closeDateTimePicker();
				}}
			>
				<div
					className="supplier-popup-content supplier-delete-popup"
					style={{
						backgroundColor: theme === 'light' ? 'var(--whiteBeMax)' : 'var(--noirbe)',
						boxShadow: theme === 'light' ? '0 10px 30px rgba(0,0,0,0.18)' : '0 10px 30px rgba(0,0,0,0.4)',
						maxHeight: '80vh',
						overflowY: 'auto'
					}}
					onClick={(event) => event.stopPropagation()}
				>
					<div className="supplier-popup-header">
						<h3>Date et heure</h3>
					</div>

					<div className="supplier-popup-form" style={{ marginTop: '16px' }}>
						<div className="supplier-popup-field" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
							<div style={{ flex: '1 1 120px' }}>
								<label className="supplier-popup-label">Jour</label>
								<select
									className={`supplier-popup-select supplier-popup-select--compact ${theme === 'light' ? 'light' : 'dark'}`}
									value={dateTimePickerDay}
									onChange={(event) => setDateTimePickerDay(event.target.value)}
									disabled={isSubmitting}
								>
									{Array.from({ length: getDaysInMonth(Number(dateTimePickerYear), Number(dateTimePickerMonth)) }, (_, index) => {
										const value = String(index + 1).padStart(2, '0');
										return (
											<option key={value} value={value}>{value}</option>
										);
									})}
								</select>
							</div>
							<div style={{ flex: '1 1 120px' }}>
								<label className="supplier-popup-label">Mois</label>
								<select
									className={`supplier-popup-select supplier-popup-select--compact ${theme === 'light' ? 'light' : 'dark'}`}
									value={dateTimePickerMonth}
									onChange={(event) => setDateTimePickerMonth(event.target.value)}
									disabled={isSubmitting}
								>
									{Array.from({ length: 12 }, (_, index) => {
										const value = String(index + 1).padStart(2, '0');
										return (
											<option key={value} value={value}>{value}</option>
										);
									})}
								</select>
							</div>
							<div style={{ flex: '1 1 140px' }}>
								<label className="supplier-popup-label">Année</label>
								<select
									className={`supplier-popup-select supplier-popup-select--compact ${theme === 'light' ? 'light' : 'dark'}`}
									value={dateTimePickerYear}
									onChange={(event) => setDateTimePickerYear(event.target.value)}
									disabled={isSubmitting}
								>
									{Array.from({ length: 11 }, (_, index) => {
										const currentYear = new Date().getFullYear();
										const value = String(currentYear - 5 + index);
										return (
											<option key={value} value={value}>{value}</option>
										);
									})}
								</select>
							</div>
						</div>

						<div className="supplier-popup-field" style={{ display: 'flex', gap: '12px' }}>
							<div style={{ flex: 1 }}>
								<label className="supplier-popup-label">Heure</label>
								<select
									className={`supplier-popup-select supplier-popup-select--compact ${theme === 'light' ? 'light' : 'dark'}`}
									value={dateTimePickerHour}
									onChange={(event) => setDateTimePickerHour(event.target.value)}
									disabled={isSubmitting}
								>
									{Array.from({ length: 24 }, (_, index) => {
										const value = String(index).padStart(2, '0');
										return (
											<option key={value} value={value}>{value}</option>
										);
									})}
								</select>
							</div>
							<div style={{ flex: 1 }}>
								<label className="supplier-popup-label">Minute</label>
								<select
									className={`supplier-popup-select supplier-popup-select--compact ${theme === 'light' ? 'light' : 'dark'}`}
									value={dateTimePickerMinute}
									onChange={(event) => setDateTimePickerMinute(event.target.value)}
									disabled={isSubmitting}
								>
									{Array.from({ length: 60 }, (_, index) => {
										const value = String(index).padStart(2, '0');
										return (
											<option key={value} value={value}>{value}</option>
										);
									})}
								</select>
							</div>
						</div>
					</div>

					<div className="supplier-popup-actions">
						<BasicButton
							variant={'outlined'}
							color={'var(--ThemClaire)'}
							colorH={'var(--white)'}
							bgColor={'transparent'}
							bgColorH={'var(--ThemClaire)'}
							bgColorA={'var(--ThemClaire)'}
							brdrColor={'var(--ThemClaire)'}
							brdrColorH={'var(--ThemClaire)'}
							textBtn={'Annuler'}
							width={110}
							padding={'7.7px 0px 9px 0px'}
							onClick={closeDateTimePicker}
						/>
						<BasicButton
							variant={'contained'}
							color={'var(--white)'}
							bgColor={'#f87269'}
							bgColorH={'#eb6258'}
							bgColorA={'#E42417'}
							brdrColor={'#f87269'}
							brdrColorH={'#eb6258'}
							textBtn={'Valider'}
							width={110}
							padding={'7.7px 0px 9px 0px'}
							onClick={confirmDateTimePicker}
						/>
					</div>
				</div>
			</div>
		)}
			{isOccupancyPopupOpen && occupancyTargetRoom && (
				<div className="supplier-popup-overlay" onClick={(event) => {
					if (event.target === event.currentTarget) closeOccupancyPopup();
				}}>
					<div
						className="supplier-popup-content"
						style={{
							backgroundColor: theme === 'light' ? 'var(--whiteBeMax)' : 'var(--noirbe)',
							boxShadow: theme === 'light' ? '0 10px 30px rgba(0,0,0,0.18)' : '0 10px 30px rgba(0,0,0,0.4)',
							width: "60%",
						}}
						onClick={(event) => event.stopPropagation()}
					>
						<div className="supplier-popup-header">
							<h3>
								{occupancyMode === 'occupation' && occupancyTargetRoom.statusKey === 'reservee'
									? 'Check-in de la chambre'
									: 'Affecter la chambre'}
								{' '}
								<span className="supplier-room-number-accent">{occupancyTargetRoom.numero}</span>
							</h3>
						</div>

						<div className="supplier-popup-form" style={{display: "flex", flexDirection: "row"}}>
							<div style={{width: "49%"}}>
								<div className="supplier-popup-field" style={{marginBottom: "15px"}}>
									<label className="supplier-popup-label">Mode</label>
									<select
										className={`supplier-popup-select ${theme === 'light' ? 'light' : 'dark'}`}
										value={occupancyMode}
										onChange={(event) => setOccupancyMode(event.target.value)}
										disabled={lockOccupancyMode || isSubmitting}
									>
										<option value="reservation">Reservation</option>
										<option value="occupation">Occupation</option>
									</select>
								</div>

								<div className="supplier-popup-field" style={{marginBottom: "15px"}}>
									<label className="supplier-popup-label">Type de séjour</label>
									<select
										className={`supplier-popup-select ${theme === 'light' ? 'light' : 'dark'}`}
										value={occupancyStayType}
										onChange={(event) => setOccupancyStayType(event.target.value)}
										disabled={isSubmitting}
									>
										<option value="nuit">Nuit</option>
										<option value="journee">Journée</option>
										<option value="passage">Passage (heure)</option>
									</select>
								</div>

								<div className="supplier-popup-field" style={{marginBottom: "15px"}}>
									<label className="supplier-popup-label">Client (optionnel)</label>
									<select
										className={`supplier-popup-select ${theme === 'light' ? 'light' : 'dark'}`}
										value={occupancyClientId}
										onChange={handleClientSelectionChange}
										disabled={isSubmitting}
									>
										<option value="">Aucun client lie</option>
										{optionsClientSelect.map((client) => (
											<option key={client.id} value={client.id}>{client.name}</option>
										))}
									</select>
								</div>

								<div className="supplier-popup-field" style={{marginBottom: "15px"}}>
									<TextField Width={'100%'} Placeholder={'Nom occupant'} value={occupancyName} onChangeValue={setOccupancyName} disabled={isSubmitting} />
								</div>
								<div className="supplier-popup-field" style={{marginBottom: "15px"}}>
									<TextField Width={'100%'} Placeholder={'Contact occupant'} value={occupancyContact} onChangeValue={setOccupancyContact} disabled={isSubmitting} />
								</div>
								<div className="supplier-popup-field" style={{marginBottom: "15px"}}>
									<TextField Width={'100%'} Placeholder={'CIN'} value={occupancyCin} onChangeValue={setOccupancyCin} disabled={isSubmitting} />
								</div>
							</div>

							<div style={{width: "49%"}}>
								<div className="supplier-popup-field" style={{marginBottom: "15px"}}>
									<label className="supplier-popup-label">Date debut</label>
									<input
										type="text"
										className={`supplier-popup-select supplier-popup-input ${theme === 'light' ? 'light' : 'dark'}`}
										value={formatDateTimeDisplay(occupancyStart)}
										readOnly
										onClick={() => openDateTimePicker('start')}
										onFocus={() => openDateTimePicker('start')}
										onKeyDown={(event) => event.preventDefault()}
										disabled={isSubmitting}
									/>
								</div>

								<div className="supplier-popup-field" style={{marginBottom: "15px"}}>
									<label className="supplier-popup-label">Date fin prevue</label>
									<input
										type="text"
										className={`supplier-popup-select supplier-popup-input ${theme === 'light' ? 'light' : 'dark'}`}
										value={formatDateTimeDisplay(occupancyEnd)}
										readOnly
										onClick={() => openDateTimePicker('end')}
										onFocus={() => openDateTimePicker('end')}
										onKeyDown={(event) => event.preventDefault()}
										disabled={isSubmitting}
									/>
								</div>

								<div className="supplier-popup-field" style={{marginBottom: "15px"}}>
									<label className="supplier-popup-label">Note</label>
									<textarea
										className={`supplier-popup-textarea ${theme === 'light' ? 'light' : 'dark'}`}
										value={occupancyNote}
										onChange={(event) => setOccupancyNote(event.target.value)}
										disabled={isSubmitting}
										rows={3}
									/>
								</div>
								<div className="supplier-popup-field" style={{marginBottom: "15px"}}>
									<label className="supplier-popup-label">Disponibilite</label>
									<div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
										<span style={{
											fontWeight: 600,
											color: availabilityStatus === 'occupied' ? 'var(--ThemClaire)' : 'inherit'
										}}>
											{availabilityStatus === 'checking'
												? 'Verification...'
												: (availabilityStatus === 'occupied'
													? 'Occupee'
													: (availabilityStatus === 'free'
														? 'Libre'
														: (availabilityStatus === 'invalid'
															? (availabilityMessage || 'Date invalide')
															: '-')))}
										</span>
										{availabilityStatus === 'occupied' && availabilityConflict?.date_debut && (
											<span style={{ opacity: 0.8 }}>
												{formatDateTime(availabilityConflict.date_debut)}
												{availabilityConflict.date_fin_prevue
													? ` - ${formatDateTime(availabilityConflict.date_fin_prevue)}`
													: ''}
											</span>
										)}
									</div>
								</div>
								<div className="supplier-popup-field" style={{marginBottom: "15px"}}>
									<label className="supplier-popup-label">Montant total (aperçu)</label>
									<div>
										{occupancyTotalLabel}
										{reservationSummary.durationLabel ? ` ( ${reservationSummary.durationLabel} )` : ''}
									</div>
								</div>
							</div>
						</div>

						<div className="supplier-popup-actions">
							<BasicButton
								variant={'outlined'}
								color={'var(--ThemClaire)'}
								colorH={'var(--white)'}
								bgColor={'transparent'}
								bgColorH={'var(--ThemClaire)'}
								bgColorA={'var(--ThemClaire)'}
								brdrColor={'var(--ThemClaire)'}
								brdrColorH={'var(--ThemClaire)'}
								textBtn={'Annuler'}
								width={110}
								padding={'7.7px 0px 9px 0px'}
								onClick={closeOccupancyPopup}
							/>
							<BasicButton
								variant={'contained'}
								color={'var(--white)'}
								bgColor={'#f87269'}
								bgColorH={'#eb6258'}
								bgColorA={'#E42417'}
								brdrColor={'#f87269'}
								brdrColorH={'#eb6258'}
								textBtn={isSubmitting ? 'Validation...' : 'Valider'}
								width={110}
								padding={'7.7px 0px 9px 0px'}
								onClick={handleConfirmOccupancy}
							/>
						</div>
					</div>
				</div>
			)}

			{isOccupancyConfirmOpen && occupancyTargetRoom && (
				<div className="supplier-popup-overlay" onClick={(event) => {
					if (event.target === event.currentTarget) closeOccupancyConfirm();
				}}>
					<div
						className="supplier-popup-content"
						style={{
							backgroundColor: theme === 'light' ? 'var(--whiteBeMax)' : 'var(--noirbe)',
							boxShadow: theme === 'light' ? '0 10px 30px rgba(0,0,0,0.18)' : '0 10px 30px rgba(0,0,0,0.4)',
							maxHeight: '80vh',
							overflowY: 'auto',
							width: "min(900px, 92%)"
						}}
						onClick={(event) => event.stopPropagation()}
					>
						<div className="supplier-popup-header">
							<h3 style={{color: "var(--Them)"}}>Confirmation</h3>
						</div>

						<div className="supplier-popup-form supplier-popup-form--history">
							<div className="supplier-popup-field" >
								<label className="supplier-popup-label">Client</label>
								<div>{occupancyConfirmSummary.client}</div>
							</div>
							<div className="supplier-popup-field" >
								<label className="supplier-popup-label">Contact</label>
								<div>{occupancyConfirmSummary.contact}</div>
							</div>
							<div className="supplier-popup-field" >
								<label className="supplier-popup-label">CIN</label>
								<div>{occupancyConfirmSummary.cin}</div>
							</div>
							<div className="supplier-popup-field" >
								<label className="supplier-popup-label">Mode</label>
								<div>{occupancyConfirmSummary.mode}</div>
							</div>
							<div className="supplier-popup-field" >
								<label className="supplier-popup-label">Type de séjour</label>
								<div>{occupancyConfirmSummary.stay}</div>
							</div>
							<div className="supplier-popup-field" >
								<label className="supplier-popup-label">Début</label>
								<div>{occupancyConfirmSummary.start}</div>
							</div>
							<div className="supplier-popup-field" >
								<label className="supplier-popup-label">Fin prévue</label>
								<div>{occupancyConfirmSummary.end}</div>
							</div>
							<div className="supplier-popup-field" >
								<label className="supplier-popup-label">Montant total</label>
								<div>{occupancyTotalLabel}</div>
							</div>
							{occupancyMode === 'reservation' && !isEditingReservation && (
								<div className="supplier-popup-field" >
									<label className="supplier-popup-label">Acompte</label>
									<div>{occupancyDepositLabel}</div>
								</div>
							)}
							{occupancyMode === 'reservation' && isEditingReservation && (
								<>
									<div className="supplier-popup-field" >
										<label className="supplier-popup-label">Acompte déjà payé</label>
										<div>{occupancyExistingDepositLabel}</div>
									</div>
									<div className="supplier-popup-field" >
										<label className="supplier-popup-label">Acompte à payer</label>
										<div>{occupancyDueDepositLabel}</div>
									</div>
								</>
							)}
						</div>

						<div className="supplier-popup-actions">
							<BasicButton
								variant={'outlined'}
								color={'var(--ThemClaire)'}
								colorH={'var(--white)'}
								bgColor={'transparent'}
								bgColorH={'var(--ThemClaire)'}
								bgColorA={'var(--ThemClaire)'}
								brdrColor={'var(--ThemClaire)'}
								brdrColorH={'var(--ThemClaire)'}
								textBtn={'Non'}
								width={110}
								padding={'7.7px 0px 9px 0px'}
								onClick={closeOccupancyConfirm}
							/>
							<BasicButton
								variant={'contained'}
								color={'var(--white)'}
								bgColor={'#f87269'}
								bgColorH={'#eb6258'}
								bgColorA={'#E42417'}
								brdrColor={'#f87269'}
								brdrColorH={'#eb6258'}
								textBtn={isSubmitting ? 'Validation...' : 'Oui'}
								width={110}
								padding={'7.7px 0px 9px 0px'}
								onClick={handleConfirmOccupancyYes}
							/>
						</div>
					</div>
				</div>
			)}

		{isDepositPopupOpen && occupancyTargetRoom && (
			<div className="supplier-popup-overlay" onClick={(event) => {
				if (event.target === event.currentTarget) closeDepositPopup();
			}}>
				<div
					className="supplier-popup-content"
					style={{
						backgroundColor: theme === 'light' ? 'var(--whiteBeMax)' : 'var(--noirbe)',
						boxShadow: theme === 'light' ? '0 10px 30px rgba(0,0,0,0.18)' : '0 10px 30px rgba(0,0,0,0.4)'
					}}
					onClick={(event) => event.stopPropagation()}
				>
					<div className="supplier-popup-header">
						<h3>
							Acompte reservation
							{' '}
							<span className="supplier-room-number-accent">{occupancyTargetRoom.numero}</span>
						</h3>
					</div>

					<p className="supplier-delete-text" style={{ marginTop: '12px' }}>
						Total sejour : <strong>{formatNumberWithSpace(reservationSummary.total)} Ar</strong>
						{reservationSummary.durationLabel ? ` ( ${reservationSummary.durationLabel} )` : ''}
					</p>
					<p className="supplier-delete-text" style={{ marginTop: '6px' }}>
						Acompte minimum : <strong>{formatNumberWithSpace(reservationSummary.minDeposit)} Ar</strong>
					</p>
					{isEditingReservation && (
						<>
							<p className="supplier-delete-text" style={{ marginTop: '6px' }}>
								Acompte déjà payé : <strong>{formatNumberWithSpace(existingReservationDeposit)} Ar</strong>
							</p>
							<p className="supplier-delete-text" style={{ marginTop: '6px' }}>
								Acompte à payer : <strong>{formatNumberWithSpace(requiredReservationDeposit)} Ar</strong>
							</p>
						</>
					)}

					<div className="supplier-popup-field" style={{ marginTop: '12px' }}>
						<TextField
							Width={'100%'}
							Placeholder={isEditingReservation ? 'Montant acompte à payer' : 'Montant acompte'}
							value={depositInput}
							onChangeValue={setDepositInput}
							disabled={isSubmitting}
						/>
					</div>

					<p className="supplier-delete-text" style={{ marginTop: '8px' }}>
						Reste apres acompte : <strong>{formatNumberWithSpace(depositReste)} Ar</strong>
					</p>

					<div className="supplier-popup-actions">
						<BasicButton
							variant={'outlined'}
							color={'var(--ThemClaire)'}
							colorH={'var(--white)'}
							bgColor={'transparent'}
							bgColorH={'var(--ThemClaire)'}
							bgColorA={'var(--ThemClaire)'}
							brdrColor={'var(--ThemClaire)'}
							brdrColorH={'var(--ThemClaire)'}
							textBtn={'Annuler'}
							width={110}
							padding={'7.7px 0px 9px 0px'}
							onClick={closeDepositPopup}
						/>
						<BasicButton
							variant={'contained'}
							color={'var(--white)'}
							bgColor={'#f87269'}
							bgColorH={'#eb6258'}
							bgColorA={'#E42417'}
							brdrColor={'#f87269'}
							brdrColorH={'#eb6258'}
							textBtn={isSubmitting ? 'Validation...' : 'Valider'}
							width={110}
							padding={'7.7px 0px 9px 0px'}
							onClick={handleConfirmDeposit}
						/>
					</div>
				</div>
			</div>
		)}
			{isReleasePopupOpen && releaseTargetRoom && (
				<div className="supplier-popup-overlay" onClick={(event) => {
					if (event.target === event.currentTarget) closeReleasePopup();
				}}>
					<div
						className="supplier-popup-content supplier-delete-popup"
						style={{
							backgroundColor: theme === 'light' ? 'var(--whiteBeMax)' : 'var(--noirbe)',
							boxShadow: theme === 'light' ? '0 10px 30px rgba(0,0,0,0.18)' : '0 10px 30px rgba(0,0,0,0.4)'
						}}
						onClick={(event) => event.stopPropagation()}
					>
						<div className="supplier-popup-header">
							<h3>Liberation chambre {releaseTargetRoom.numero}</h3>
						</div>

						<p className="supplier-delete-text">
							{releaseTargetRoom.occupationType === 'reservation'
								? 'Confirme la fin/annulation de cette reservation.'
								: 'Confirme la liberation de cette chambre (check-out).'}
						</p>

						{releaseTargetRoom.occupationType === 'reservation' && (
							<div className="supplier-popup-field" style={{ marginTop: '8px' }}>
								<label className="supplier-popup-label">Mode</label>
								<select
									className={`supplier-popup-select ${theme === 'light' ? 'light' : 'dark'}`}
									value={releaseMode}
									onChange={(event) => setReleaseMode(event.target.value)}
									disabled={isSubmitting}
								>
									<option value="cancel">Annulation reservation</option>
									<option value="no_show">No-show</option>
									<option value="checkout">Reservation terminee</option>
								</select>
							</div>
						)}


							{releaseMode === 'checkout' && (
								!releaseIsPaid ? (
									<>
										<div className="supplier-popup-field" style={{ marginTop: '10px' }}>
											<label className="supplier-popup-label">Montant recu</label>
											<TextField
												Width={'100%'}
												Placeholder={'Montant recu'}
												value={releaseMontantInput}
												onChangeValue={setReleaseMontantInput}
												disabled={isSubmitting}
											/>
										</div>
										<p className="supplier-delete-text" style={{ marginTop: '8px' }}>
											Reste a payer : <strong>{formatNumberWithSpace(releaseSummary.reste)} Ar</strong>
										</p>
										<p className="supplier-delete-text" style={{ marginTop: '6px' }}>
											A rendre : <strong>{formatNumberWithSpace(releaseARendre)} Ar</strong>
										</p>
										<p className="supplier-delete-text" style={{ marginTop: '4px' }}>
											Reste apres paiement : <strong>{formatNumberWithSpace(releaseResteApres)} Ar</strong>
										</p>
									</>
								) : (
									<p className="supplier-delete-text" style={{ marginTop: '8px' }}>
										Paiement deja complet.
									</p>
								)
							)}
						<div className="supplier-popup-field" style={{ marginTop: '10px' }}>
							<label className="supplier-popup-label">Note (optionnel)</label>
							<textarea
								className={`supplier-popup-textarea ${theme === 'light' ? 'light' : 'dark'}`}
								value={releaseNote}
								onChange={(event) => setReleaseNote(event.target.value)}
								disabled={isSubmitting}
								rows={3}
							/>
						</div>

						<div className="supplier-popup-actions">
							<BasicButton
								variant={'outlined'}
								color={'var(--ThemClaire)'}
								colorH={'var(--white)'}
								bgColor={'transparent'}
								bgColorH={'var(--ThemClaire)'}
								bgColorA={'var(--ThemClaire)'}
								brdrColor={'var(--ThemClaire)'}
								brdrColorH={'var(--ThemClaire)'}
								textBtn={'Annuler'}
								width={110}
								padding={'7.7px 0px 9px 0px'}
								onClick={closeReleasePopup}
							/>
							<BasicButton
								variant={'contained'}
								color={'var(--white)'}
								bgColor={'#f87269'}
								bgColorH={'#eb6258'}
								bgColorA={'#E42417'}
								brdrColor={'#f87269'}
								brdrColorH={'#eb6258'}
								textBtn={isSubmitting ? 'Liberation...' : 'Confirmer'}
								width={110}
								padding={'7.7px 0px 9px 0px'}
								onClick={handleConfirmRelease}
							/>
						</div>
					</div>
				</div>
			)}

			{isPayNowPopupOpen && payNowTargetRoom && (
				<div className="supplier-popup-overlay" onClick={(event) => {
					if (event.target === event.currentTarget) closePayNowPopup();
				}}>
					<div
						className="supplier-popup-content supplier-delete-popup"
						style={{
							backgroundColor: theme === 'light' ? 'var(--whiteBeMax)' : 'var(--noirbe)',
							boxShadow: theme === 'light' ? '0 10px 30px rgba(0,0,0,0.18)' : '0 10px 30px rgba(0,0,0,0.4)'
						}}
						onClick={(event) => event.stopPropagation()}
					>
						<div className="supplier-popup-header">
							<h3>Paiement chambre {payNowTargetRoom.numero}</h3>
						</div>

						<p className="supplier-delete-text">
							Encaissement pour cette occupation.
						</p>

						{!payNowIsPaid ? (
							<>
								<div className="supplier-popup-field" style={{ marginTop: '10px' }}>
									<label className="supplier-popup-label">Montant recu</label>
									<TextField
										Width={'100%'}
										Placeholder={'Montant recu'}
										value={payNowMontantInput}
										onChangeValue={setPayNowMontantInput}
										disabled={isSubmitting}
									/>
								</div>
								<p className="supplier-delete-text" style={{ marginTop: '8px' }}>
									Reste a payer : <strong>{formatNumberWithSpace(payNowSummary.reste)} Ar</strong>
								</p>
								<p className="supplier-delete-text" style={{ marginTop: '6px' }}>
									A rendre : <strong>{formatNumberWithSpace(payNowARendre)} Ar</strong>
								</p>
								<p className="supplier-delete-text" style={{ marginTop: '4px' }}>
									Reste apres paiement : <strong>{formatNumberWithSpace(payNowResteApres)} Ar</strong>
								</p>
							</>
						) : (
							<p className="supplier-delete-text" style={{ marginTop: '8px' }}>
								Paiement deja complet.
							</p>
						)}

						<div className="supplier-popup-actions">
							<BasicButton
								variant={'outlined'}
								color={'var(--ThemClaire)'}
								colorH={'var(--white)'}
								bgColor={'transparent'}
								bgColorH={'var(--ThemClaire)'}
								bgColorA={'var(--ThemClaire)'}
								brdrColor={'var(--ThemClaire)'}
								brdrColorH={'var(--ThemClaire)'}
								textBtn={'Annuler'}
								width={110}
								padding={'7.7px 0px 9px 0px'}
								onClick={closePayNowPopup}
							/>
							<BasicButton
								variant={'contained'}
								color={'var(--white)'}
								bgColor={'#f87269'}
								bgColorH={'#eb6258'}
								bgColorA={'#E42417'}
								brdrColor={'#f87269'}
								brdrColorH={'#eb6258'}
								textBtn={isSubmitting ? 'Validation...' : (!payNowIsPaid ? 'Valider' : 'Payé')}
								width={110}
								padding={'7.7px 0px 9px 0px'}
								onClick={!payNowIsPaid ? handleConfirmPayNow : null}
							/>
						</div>
					</div>
				</div>
			)}

			{isDeletePopupOpen && (
				<div className="supplier-popup-overlay" onClick={(event) => {
					if (event.target === event.currentTarget) closeDeletePopup();
				}}>
					<div
						className="supplier-popup-content supplier-delete-popup"
						style={{
							backgroundColor: theme === 'light' ? 'var(--whiteBeMax)' : 'var(--noirbe)',
							boxShadow: theme === 'light' ? '0 10px 30px rgba(0,0,0,0.18)' : '0 10px 30px rgba(0,0,0,0.4)'
						}}
						onClick={(event) => event.stopPropagation()}
					>
						<div className="supplier-popup-header">
							<h3>Confirmation suppression</h3>
						</div>

						<p className="supplier-delete-text">
							Voulez-vous vraiment supprimer la chambre
							<strong> {deleteRoomTarget?.numero || ''}</strong> ?
						</p>

						<div className="supplier-popup-actions">
							<BasicButton
								variant={'outlined'}
								color={'var(--ThemClaire)'}
								colorH={'var(--white)'}
								bgColor={'transparent'}
								bgColorH={'var(--ThemClaire)'}
								bgColorA={'var(--ThemClaire)'}
								brdrColor={'var(--ThemClaire)'}
								brdrColorH={'var(--ThemClaire)'}
								textBtn={'Annuler'}
								width={110}
								padding={'7.7px 0px 9px 0px'}
								onClick={closeDeletePopup}
							/>
							<BasicButton
								variant={'contained'}
								color={'var(--white)'}
								bgColor={'#f87269'}
								bgColorH={'#eb6258'}
								bgColorA={'#E42417'}
								brdrColor={'#f87269'}
								brdrColorH={'#eb6258'}
								textBtn={isSubmitting ? 'Suppression...' : 'Oui'}
								width={110}
								padding={'7.7px 0px 9px 0px'}
								onClick={handleConfirmDeleteRoom}
							/>
						</div>
					</div>
				</div>
			)}
			{isHistoryDetailOpen && historyDetail && (
				<div className="supplier-popup-overlay" onClick={(event) => {
					if (event.target === event.currentTarget) closeHistoryDetail();
				}}>
					<div
						className="supplier-popup-content"
						style={{
							backgroundColor: theme === 'light' ? 'var(--whiteBeMax)' : 'var(--noirbe)',
							boxShadow: theme === 'light' ? '0 10px 30px rgba(0,0,0,0.18)' : '0 10px 30px rgba(0,0,0,0.4)',
							maxHeight: '80vh',
							overflowY: 'auto',
							width: "min(1200px, 92%)"
						}}
						onClick={(event) => event.stopPropagation()}
					>
						<div className="supplier-popup-header">
							<h3>Historique chambre {historyDetail.numero}</h3>
						</div>

						<div className="supplier-popup-form supplier-popup-form--history">
							<div className="supplier-popup-field" >
								<label className="supplier-popup-label">N°</label>
								<div>{historyDetail.numero}</div>
							</div>
							<div className="supplier-popup-field" >
								<label className="supplier-popup-label">Type</label>
								<div>{historyDetail.type}</div>
							</div>
							<div className="supplier-popup-field" >
								<label className="supplier-popup-label">Occupation</label>
								<div>{historyDetail.occupation}</div>
							</div>
							<div className="supplier-popup-field" >
								<label className="supplier-popup-label">Prix nuit</label>
								<div>{historyDetail.prix_nuit}</div>
							</div>
							<div className="supplier-popup-field" >
								<label className="supplier-popup-label">Client</label>
								<div>{historyDetail.client}</div>
							</div>
							<div className="supplier-popup-field" >
								<label className="supplier-popup-label">CIN</label>
								<div>{historyDetail.cin}</div>
							</div>
							<div className="supplier-popup-field" >
								<label className="supplier-popup-label">Contact</label>
								<div>{historyDetail.contact}</div>
							</div>
							<div className="supplier-popup-field" >
								<label className="supplier-popup-label">Note</label>
								<div>{historyDetail.note}</div>
							</div>
							<div className="supplier-popup-field" >
								<label className="supplier-popup-label">Statut</label>
								<div>{historyDetail.statut}</div>
							</div>
							<div className="supplier-popup-field" >
								<label className="supplier-popup-label">Début</label>
								<div>{historyDetail.debut}</div>
							</div>
							<div className="supplier-popup-field" >
								<label className="supplier-popup-label">Fin prévue</label>
								<div>{historyDetail.fin_prevue}</div>
							</div>
							<div className="supplier-popup-field" >
								<label className="supplier-popup-label">Fin réelle</label>
								<div>{historyDetail.fin_reelle}</div>
							</div>
							{historyDetail.stay_count_label && (
								<div className="supplier-popup-field" >
									<label className="supplier-popup-label">{historyDetail.stay_count_label}</label>
									<div>{historyDetail.stay_count_value}</div>
								</div>
							)}
							{historyDetail.stay_count_label && (
								<div className="supplier-popup-field" >
									<label className="supplier-popup-label">Heures sup</label>
									<div>{historyDetail.heures_supp}</div>
								</div>
							)}
							<div className="supplier-popup-field" >
								<label className="supplier-popup-label">Acompte</label>
								<div>{historyDetail.acompte}</div>
							</div>
							<div className="supplier-popup-field" >
								<label className="supplier-popup-label">Date acompte</label>
								<div>{historyDetail.date_acompte}</div>
							</div>
							<div className="supplier-popup-field" >
								<label className="supplier-popup-label">Solde</label>
								<div>{historyDetail.solde}</div>
							</div>
							<div className="supplier-popup-field" >
								<label className="supplier-popup-label">Date solde</label>
								<div>{historyDetail.date_solde}</div>
							</div>
							<div className="supplier-popup-field" >
								<label className="supplier-popup-label">Montant total</label>
								<div>{historyDetail.montant_total}</div>
							</div>
							<div className="supplier-popup-field" >
								<label className="supplier-popup-label">Total reçu</label>
								<div>{historyDetail.montant_recu}</div>
							</div>
						</div>

						<div className="supplier-popup-actions">
							<BasicButton
								variant={'outlined'}
								color={'var(--ThemClaire)'}
								colorH={'var(--white)'}
								bgColor={'transparent'}
								bgColorH={'var(--ThemClaire)'}
								bgColorA={'var(--ThemClaire)'}
								brdrColor={'var(--ThemClaire)'}
								brdrColorH={'var(--ThemClaire)'}
								textBtn={'Fermer'}
								width={110}
								padding={'7.7px 0px 9px 0px'}
								onClick={closeHistoryDetail}
							/>
						</div>
					</div>
				</div>
			)}
			{isActiveHistoryDetailOpen && activeHistoryDetail && (
				<div className="supplier-popup-overlay" onClick={(event) => {
					if (event.target === event.currentTarget) closeActiveHistoryDetail();
				}}>
					<div
						className="supplier-popup-content"
						style={{
							backgroundColor: theme === 'light' ? 'var(--whiteBeMax)' : 'var(--noirbe)',
							boxShadow: theme === 'light' ? '0 10px 30px rgba(0,0,0,0.18)' : '0 10px 30px rgba(0,0,0,0.4)',
							maxHeight: '80vh',
							overflowY: 'auto',
							width: "min(1200px, 92%)"
						}}
						onClick={(event) => event.stopPropagation()}
					>
						<div className="supplier-popup-header">
							<h3>Détails occupation</h3>
						</div>

						<div className="supplier-popup-form supplier-popup-form--history">
							<div className="supplier-popup-field" >
								<label className="supplier-popup-label">Client</label>
								<div>{activeHistoryDetail.client}</div>
							</div>
							<div className="supplier-popup-field" >
								<label className="supplier-popup-label">CIN</label>
								<div>{activeHistoryDetail.cin}</div>
							</div>
							<div className="supplier-popup-field" >
								<label className="supplier-popup-label">Contact</label>
								<div>{activeHistoryDetail.contact}</div>
							</div>
							<div className="supplier-popup-field" >
								<label className="supplier-popup-label">Note</label>
								<div>{activeHistoryDetail.note}</div>
							</div>
							<div className="supplier-popup-field" >
								<label className="supplier-popup-label">Occupation</label>
								<div>{activeHistoryDetail.occupation}</div>
							</div>
							<div className="supplier-popup-field" >
								<label className="supplier-popup-label">Séjour</label>
								<div>{activeHistoryDetail.sejour}</div>
							</div>
							<div className="supplier-popup-field" >
								<label className="supplier-popup-label">Prix nuit</label>
								<div>{activeHistoryDetail.prix_nuit}</div>
							</div>
							{activeHistoryDetail.stay_count_label && (
								<div className="supplier-popup-field" >
									<label className="supplier-popup-label">{activeHistoryDetail.stay_count_label}</label>
									<div>{activeHistoryDetail.stay_count_value}</div>
								</div>
							)}
							{activeHistoryDetail.show_extra_hours && (
								<div className="supplier-popup-field" >
									<label className="supplier-popup-label">Heures supp.</label>
									<div>{activeHistoryDetail.heures_supp}</div>
								</div>
							)}
							<div className="supplier-popup-field" >
								<label className="supplier-popup-label">Fin réelle</label>
								<div>{activeHistoryDetail.fin_reelle}</div>
							</div>
							<div className="supplier-popup-field" >
								<label className="supplier-popup-label">Acompte</label>
								<div>{activeHistoryDetail.acompte}</div>
							</div>
							<div className="supplier-popup-field" >
								<label className="supplier-popup-label">Date acompte</label>
								<div>{activeHistoryDetail.date_acompte}</div>
							</div>
							<div className="supplier-popup-field" >
								<label className="supplier-popup-label">Début</label>
								<div>{activeHistoryDetail.debut}</div>
							</div>
							<div className="supplier-popup-field" >
								<label className="supplier-popup-label">Fin prévue</label>
								<div>{activeHistoryDetail.fin_prevue}</div>
							</div>
							<div className="supplier-popup-field" >
								<label className="supplier-popup-label">Solde</label>
								<div>{activeHistoryDetail.solde}</div>
							</div>
							<div className="supplier-popup-field" >
								<label className="supplier-popup-label">Date solde</label>
								<div>{activeHistoryDetail.date_solde}</div>
							</div>
							<div className="supplier-popup-field" >
								<label className="supplier-popup-label">Montant total</label>
								<div>{activeHistoryDetail.montant_total}</div>
							</div>
							<div className="supplier-popup-field" >
								<label className="supplier-popup-label">Total reçu</label>
								<div>{activeHistoryDetail.montant_recu}</div>
							</div>
						</div>

						<div className="supplier-popup-actions">
							<BasicButton
								variant={'outlined'}
								color={'var(--ThemClaire)'}
								colorH={'var(--white)'}
								bgColor={'transparent'}
								bgColorH={'var(--ThemClaire)'}
								bgColorA={'var(--ThemClaire)'}
								brdrColor={'var(--ThemClaire)'}
								brdrColorH={'var(--ThemClaire)'}
								textBtn={'Fermer'}
								width={110}
								padding={'7.7px 0px 9px 0px'}
								onClick={closeActiveHistoryDetail}
							/>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
