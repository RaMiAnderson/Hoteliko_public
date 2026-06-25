import { useEffect, useRef } from "react";

let sharedEventSource = null;
let sharedApiUrl = null;
const subscribers = new Set();

const notifySubscribers = (payload) => {
	subscribers.forEach((subscriber) => {
		try {
			subscriber(payload);
		} catch (err) {
			console.log("Erreur subscriber realtime:", err);
		}
	});
};

const ensureSharedEventSource = (apiUrl) => {
	if (!apiUrl) return;

	const mustRecreate =
		!sharedEventSource ||
		sharedEventSource.readyState === EventSource.CLOSED ||
		sharedApiUrl !== apiUrl;

	if (!mustRecreate) return;

	if (sharedEventSource) {
		sharedEventSource.close();
	}

	sharedApiUrl = apiUrl;
	sharedEventSource = new EventSource(`${apiUrl}/api/realtime/stream`);

	sharedEventSource.addEventListener("data-change", (event) => {
		try {
			const payload = JSON.parse(event.data);
			notifySubscribers(payload);
		} catch (err) {
			console.log("Erreur parsing SSE data-change:", err);
		}
	});

	sharedEventSource.onerror = () => {
	};
};

const releaseSharedEventSourceIfUnused = () => {
	if (subscribers.size > 0) return;
	if (!sharedEventSource) return;

	sharedEventSource.close();
	sharedEventSource = null;
	sharedApiUrl = null;
};

export default function useRealtimeEvents(onDataChange) {
	const API_URL = import.meta.env.VITE_API_URL;
	const onDataChangeRef = useRef(onDataChange);

	useEffect(() => {
		onDataChangeRef.current = onDataChange;
	}, [onDataChange]);

	useEffect(() => {
		if (!API_URL) return undefined;

		ensureSharedEventSource(API_URL);

		const subscriber = (payload) => {
			if (onDataChangeRef.current) {
				onDataChangeRef.current(payload);
			}
		};

		subscribers.add(subscriber);

		return () => {
			subscribers.delete(subscriber);
			releaseSharedEventSourceIfUnused();
		};
	}, [API_URL]);
}
