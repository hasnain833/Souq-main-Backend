const Transaction = require('../../../../db/models/transactionModel');

// Build PayPal API base URL from env (sandbox by default)
const PAYPAL_API = process.env.PAYPAL_API || 'https://api-m.sandbox.paypal.com';

// Get OAuth 2.0 access token from PayPal using client credentials
async function getAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET');
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal token error: ${res.status} ${text}`);
  }
  const data = await res.json();
  return data.access_token;
}

/**
 * Create a PayPal order (Checkout)
 * POST /api/paypal/create-order
 * body: { amount: number|string, currency: string='USD', metadata?: { productId, buyerId, sellerId } }
 */
exports.createOrder = async (req, res) => {
  try {
    const amount = parseFloat(req.body?.amount ?? 0);
    const currency = (req.body?.currency || 'USD').toUpperCase();
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid amount' });
    }

    const accessToken = await getAccessToken();
    const createRes = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: currency,
              value: amount.toFixed(2),
            },
          },
        ],
      }),
    });

    const order = await createRes.json();
    if (!createRes.ok) {
      return res.status(502).json({ success: false, error: order });
    }

    // Optionally, create a pending transaction record
    try {
      await Transaction.create({
        gatewayTransactionId: order.id,
        escrowTransaction: req.body?.metadata?.escrowTransaction || undefined,
        buyer: req.body?.metadata?.buyerId || undefined,
        seller: req.body?.metadata?.sellerId || undefined,
        product: req.body?.metadata?.productId || undefined,
        amount,
        currency,
        paymentGateway: 'paypal',
        status: 'processing',
        gatewayResponse: order,
      });
    } catch (_) {}

    return res.status(200).json({ success: true, orderId: order.id, order });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Capture a PayPal order
 * POST /api/paypal/capture-order
 * body: { orderId: string }
 */
exports.captureOrder = async (req, res) => {
  try {
    const { orderId } = req.body || {};
    if (!orderId) {
      return res.status(400).json({ success: false, error: 'Missing orderId' });
    }

    const accessToken = await getAccessToken();
    const capRes = await fetch(`${PAYPAL_API}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const capture = await capRes.json();
    if (!capRes.ok) {
      return res.status(502).json({ success: false, error: capture });
    }

    // Extract payer details and capture status
    const payer = capture?.payer || {};
    const purchaseUnit = Array.isArray(capture?.purchase_units) ? capture.purchase_units[0] : null;
    const payments = purchaseUnit?.payments || {};
    const firstCapture = Array.isArray(payments?.captures) ? payments.captures[0] : null;

    // Update transaction if exists
    try {
      const tx = await Transaction.findOne({ gatewayTransactionId: orderId });
      if (tx) {
        tx.status = 'completed';
        tx.gatewayResponse = { ...(tx.gatewayResponse || {}), capture };
        if (firstCapture?.amount?.value) tx.amount = parseFloat(firstCapture.amount.value);
        if (firstCapture?.amount?.currency_code) tx.currency = firstCapture.amount.currency_code;
        await tx.save();
      }
    } catch (_) {}

    return res.status(200).json({
      success: true,
      status: firstCapture?.status || capture?.status || 'COMPLETED',
      transactionId: firstCapture?.id || orderId,
      payer,
      capture,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};


