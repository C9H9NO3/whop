const express = require("express");
const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3000;
const WHOP_API_KEY = process.env.WHOP_API_KEY;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET; // A password you create

async function refundCustomerByEmail(email, amountInCents = null) {
	const headers = {
		Authorization: `Bearer ${WHOP_API_KEY}`,
		"Content-Type": "application/json",
		Accept: "application/json",
	};

	// 1. Find the member by email
	const memberResp = await fetch(
		`https://api.whop.com/api/v2/members?query=${encodeURIComponent(email)}`,
		{ headers },
	);
	const members = await memberResp.json();

	if (!members.data || members.data.length === 0)
		throw new Error("Member not found");

	const memberId = members.data[0].id;

	// 2. Find the most recent payment
	const payResp = await fetch(
		`https://api.whop.com/api/v2/payments?member_id=${memberId}`,
		{ headers },
	);
	const payments = await payResp.json();

	if (!payments.data || payments.data.length === 0)
		throw new Error("No payments found");

	const paymentId = payments.data[0].id;

	// 3. Issue the refund
	const refundBody = amountInCents
		? JSON.stringify({ amount: amountInCents })
		: JSON.stringify({});
	const refundResp = await fetch(
		`https://api.whop.com/api/v2/payments/${paymentId}/refund`,
		{
			method: "POST",
			headers,
			body: refundBody,
		},
	);

	const result = await refundResp.json();
	if (!refundResp.ok) throw new Error(result.message || "Refund failed");

	return result;
}

// POST endpoint for your webhook
app.post("/webhook/refund", async (req, res) => {
	const { email, amount, secret } = req.body;

	// Basic Security Check
	if (secret !== WEBHOOK_SECRET) {
		return res.status(401).json({ error: "Unauthorized" });
	}

	if (!email) {
		return res.status(400).json({ error: "Email is required" });
	}

	try {
		const result = await refundCustomerByEmail(email, amount);
		res.status(200).json({ success: true, data: result });
	} catch (error) {
		res.status(500).json({ success: false, error: error.message });
	}
});

app.listen(PORT, () => console.log(`Refund webhook listening on port ${PORT}`));
