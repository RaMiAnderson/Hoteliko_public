const express = require("express");
const router = express.Router();

const { addClient, removeClient } = require("../services/realtimeEvents");

router.get("/stream", (req, res) => {
	res.setHeader("Content-Type", "text/event-stream");
	res.setHeader("Cache-Control", "no-cache");
	res.setHeader("Connection", "keep-alive");
	res.setHeader("X-Accel-Buffering", "no");

	if (typeof res.flushHeaders === "function") {
		res.flushHeaders();
	}

	res.write("retry: 3000\n\n");
	addClient(res);

	const heartbeat = setInterval(() => {
		if (!res.writableEnded) {
			res.write(": ping\n\n");
		}
	}, 25000);

	req.on("close", () => {
		clearInterval(heartbeat);
		removeClient(res);
	});
});

module.exports = router;
