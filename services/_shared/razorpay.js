// Shared Razorpay client. Keys are read lazily so tests can set them before first use.
export const razorpayConfigured = () =>
  Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

let client = null;

export const razorpayClient = async () => {
  if (!client) {
    const { default: Razorpay } = await import('razorpay');
    client = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return client;
};

// Test seam: swap in a fake client.
export const setRazorpayClientForTests = (fake) => { client = fake; };

export const toPaise = (rupees) => Math.round(rupees * 100);
