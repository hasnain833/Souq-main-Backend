const PlatformFee = require("../../db/models/platformFeeModel");

const DEFAULT_PERCENT = Number(process.env.DEFAULT_PLATFORM_FEE_PERCENT || 5);
const DEFAULT_RATE = DEFAULT_PERCENT / 100;

async function calculatePlatformCommission({
  amount,
  currency = "USD",
  categoryId = null,
  userId = null,
}) {
  if (!amount || amount <= 0) {
    return {
      commissionAmount: 0,
      commissionPercentage: 0,
      configId: null,
      configVersion: null,
      appliedRule: "none",
    };
  }

  let activeConfig =
    typeof PlatformFee.getActiveFeeStructure === "function"
      ? await PlatformFee.getActiveFeeStructure()
      : await PlatformFee.findOne({ isActive: true }).sort({ createdAt: -1 });

  if (!activeConfig) {
    const fallbackAmount = Math.round(amount * DEFAULT_RATE * 100) / 100;
    return {
      commissionAmount: fallbackAmount,
      commissionPercentage: DEFAULT_PERCENT,
      configId: null,
      configVersion: null,
      appliedRule: "fallback",
    };
  }

  const calc = activeConfig.calculateFee(amount, currency, categoryId, userId);
  return {
    commissionAmount: calc.feeAmount,
    commissionPercentage: calc.feePercentage,
    configId: activeConfig._id,
    configVersion:
      activeConfig.version ||
      activeConfig.label ||
      activeConfig._id?.toString(),
    appliedRule: calc.appliedRule,
  };
}

async function recordPlatformFeeUsage({
  configId,
  feeAmount,
  feePercentage,
}) {
  if (!configId || !feeAmount || feeAmount <= 0) return;
  try {
    await PlatformFee.updateOne(
      { _id: configId },
      {
        $inc: {
          "statistics.totalFeesCollected": feeAmount,
          "statistics.totalTransactions": 1,
        },
        $set: {
          "statistics.lastUpdated": new Date(),
          "statistics.averageFeePercentage": feePercentage,
        },
      }
    );
  } catch (err) {
    console.error("Failed to update platform fee statistics:", err.message);
  }
}

module.exports = {
  calculatePlatformCommission,
  recordPlatformFeeUsage,
};

