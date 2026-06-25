const clients = new Set();

const writeEvent = (res, event, payload) => {
	if (!res || res.writableEnded) return;
	res.write(`event: ${event}\n`);
	res.write(`data: ${JSON.stringify(payload)}\n\n`);
};

const addClient = (res) => {
	clients.add(res);
	writeEvent(res, "connected", { ts: Date.now() });
};

const removeClient = (res) => {
	clients.delete(res);
};

const broadcastDataChange = (payload) => {
	clients.forEach((res) => {
		writeEvent(res, "data-change", {
			...payload,
			ts: Date.now()
		});
	});
};

module.exports = {
	addClient,
	removeClient,
	broadcastDataChange
};
