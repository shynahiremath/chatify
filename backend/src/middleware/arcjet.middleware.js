import aj from "../lib/arcjet.js";
import { isSpoofedBot } from "@arcjet/inspect";

export const arcjetProtection = async (req, res, next) => {
    try {
        const decision = await aj.protect(req, { requested: 1 });

        if (decision.isDenied()) {
            if (decision.reason.isRateLimit()) {
                return res.status(429).json({
                    message: "Too Many Requests. Please try again later."
                });
            } else if (decision.reason.isBot()) {
                return res.status(403).json({
                    message: "Bot access denied."
                });
            } else {
                return res.status(403).json({
                    message: "Access denied."
                });
            }
        }

        if (decision.results.some(isSpoofedBot)) {
            return res.status(403).json({
                message: "Spoofed bot detected, access denied."
            });
        }

        next();
    } catch (error) {
        logger.error("Arcjet Protection Error:", error);
        next();
    }
};