import { db } from "../firebase/firebaseAdmin.js";
import admin from "firebase-admin";
import redis from '../redis/redis.js';

// Redis TTL values in seconds
const CACHE_TTL = {
    COMPANIES: 3600, // 1 hour
    ROUNDS: 3600,    // 1 hour
    DASHBOARD: 600,  // 10 minutes
    QUESTIONS: 3600  // 1 hour (added missing constant)
};

export const createCompany = async (req, res) => {
    try {
        const { userId, companyName } = req.body;

        if (!userId || !companyName) {
            return res.status(400).json({
                success: false,
                message: "User is not authorized"
            });
        }

        const existingCompany = await db.collection("companies")
            .where("companyName", "==", companyName)
            .where("userId", "==", userId)
            .get();

        if (!existingCompany.empty) {
            return res.status(400).json({
                success: false,
                message: `You have already created the company '${companyName}'.`
            });
        }

        const companyRef = db.collection("companies").doc();
        const newCompany = {
            userId,
            companyName,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        await companyRef.set(newCompany);

        // Invalidate cache for this user's companies and dashboard
        try {
            await redis.del(`companies:${userId}`);
            await redis.del(`dashboard:${userId}`);
        } catch (redisError) {
            console.error("Redis error during cache invalidation:", redisError);
        }

        // Fetch updated company list from Firestore
        const companySnap = await db.collection("companies")
            .where("userId", "==", userId)
            .get();

        const companies = companySnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        }));

        // Cache updated company list
        try {
            await redis.set(
                `companies:${userId}`,
                JSON.stringify({ success: true, companies }),
                { ex: CACHE_TTL.COMPANIES }
            );
        } catch (redisError) {
            console.error("Redis error while setting cache:", redisError);
        }

        return res.status(200).json({
            success: true,
            companyId: companyRef.id
        });
    } catch (error) {
        console.error("Error creating company:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export const deleteCompany = async (req, res) => {
    try {
        const { userId, companyId } = req.body;
        if (!userId || !companyId) {
            return res.status(400).json({
                message: "User is not authorized",
                status: false
            });
        }

        const companyRef = await db.collection("companies").doc(companyId);
        const companyDoc = await companyRef.get();

        if (!companyDoc.exists) {
            return res.status(404).json({
                message: "Company not found",
                status: false
            });
        }

        if (companyDoc.data().userId !== userId) {
            return res.status(403).json({
                message: "Unauthorized: You can only delete your own company",
                success: false
            });
        }

        await companyRef.delete();

        // Invalidate cache for this user's companies and dashboard
        try {
            await redis.del(`rounds:${companyId}`);
            await redis.del(`companies:${userId}`);
            await redis.del(`dashboard:${userId}`);
        } catch (redisError) {
            console.error("Redis error during cache invalidation:", redisError);
            // Continue execution even if Redis fails
        }

        return res.status(200).json({
            message: "Company deleted successfully",
            success: true
        });
    } catch (error) {
        console.error("Error deleting company:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message
        });
    }
};

export const deleteRound = async (req, res) => {
    try {
        const { userId, companyId, roundId } = req.body;
        if (!userId || !companyId || !roundId) {
            return res.status(404).json({
                message: "User is unauthorized",
                status: false
            });
        }

        const companyRef = db.collection("companies").doc(companyId);
        const companyDoc = await companyRef.get();

        if (!companyDoc.exists) {
            return res.status(404).json({
                success: false,
                message: "Company not found",
            });
        }

        if (companyDoc.data().userId !== userId) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized: You can only delete rounds from your own company",
            });
        }

        const roundRef = companyRef.collection("rounds").doc(roundId);
        const roundDoc = await roundRef.get();

        if (!roundDoc.exists) {
            return res.status(404).json({
                success: false,
                message: "Round not found",
            });
        }

        await roundRef.delete();

        // Invalidate cache for this company's rounds and user's dashboard
        try {
            await redis.del(`rounds:${companyId}`);
            await redis.del(`dashboard:${userId}`);
        } catch (redisError) {
            console.error("Redis error during cache invalidation:", redisError);
            // Continue execution even if Redis fails
        }

        return res.status(200).json({
            success: true,
            message: "Round deleted successfully",
        });
    } catch (error) {
        console.error("Error deleting round:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message,
        });
    }
};

export const createRound = async (req, res) => {
    try {
        const { companyId, roundName } = req.body;

        if (!companyId || !roundName) {
            return res.status(400).json({
                message: "All fields are required",
                status: false,
            });
        }

        const validRoundNames = [
            "Technical Interview",
            "Machine Coding",
            "Behavioral Interview",
            "System Design",
            "HR Round",
            "Managerial Round"
        ];

        if (!validRoundNames.includes(roundName)) {
            return res.status(400).json({
                message: "Invalid round type selected",
                status: false,
            });
        }

        // Check if the round type already exists for this company
        const existingRounds = await db.collection("companies").doc(companyId).collection("rounds")
            .where("roundName", "==", roundName)
            .get();

        if (!existingRounds.empty) {
            return res.status(400).json({
                message: "This round type already exists for this company",
                status: false,
            });
        }

        // Get company details to get userId for cache invalidation
        const companyDoc = await db.collection("companies").doc(companyId).get();
        const userId = companyDoc.exists ? companyDoc.data().userId : null;

        const roundRef = db.collection("companies").doc(companyId).collection("rounds").doc();
        await roundRef.set({
            roundName,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Invalidate cache for this company's rounds and user's dashboard
        try {
            await redis.del(`rounds:${companyId}`);
            if (userId) {
                await redis.del(`dashboard:${userId}`);
            }
        } catch (redisError) {
            console.error("Redis error during cache invalidation:", redisError);
            // Continue execution even if Redis fails
        }

        return res.status(200).json({
            success: true,
            roundId: roundRef.id
        });
    } catch (error) {
        console.error("Error creating round:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export const fetchCompany = async (req, res) => {
    try {
        const userId = req.query.userId || req.headers["x-user-id"];

        if (!userId) {
            return res.status(400).json({
                message: "User ID is required",
                status: false
            });
        }

        // Try to get from cache, but don't fail if Redis is unavailable
        try {
            const cacheKey = `companies:${userId}`;
            const cachedData = await redis.get(cacheKey);

            // Only attempt to parse if cachedData exists and is a string
            if (cachedData && typeof cachedData === 'string') {
                return res.status(200).json(JSON.parse(cachedData));
            }
        } catch (redisError) {
            console.error("Redis error during fetchCompany:", redisError);
            // Continue to Firestore if Redis fails
        }

        // If not in cache or Redis failed, fetch from Firestore
        const companyRef = db.collection("companies");
        const snapShot = await companyRef.where("userId", "==", userId).get();

        if (snapShot.empty) {
            return res.status(404).json({
                message: "No companies found",
                status: false
            });
        }

        const companies = snapShot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        const response = {
            status: true,
            companies
        };

        // Try to set cache, but don't fail if Redis is unavailable
        try {
            const cacheKey = `companies:${userId}`;
            const jsonData = JSON.stringify(response);
            await redis.set(cacheKey, jsonData, { ex: CACHE_TTL.COMPANIES });
        } catch (redisError) {
            console.error("Redis error during cache setting:", redisError);
            // Continue execution even if Redis fails
        }

        return res.status(200).json(response);
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

export const fetchRound = async (req, res) => {
    try {
        const { companyId } = req.query;

        if (!companyId) {
            return res.status(400).json({
                message: "Company not found",
                status: false
            });
        }

        // Try to get from cache, but don't fail if Redis is unavailable
        try {
            const cacheKey = `rounds:${companyId}`;
            const cachedData = await redis.get(cacheKey);

            // Only attempt to parse if cachedData exists and is a string
            if (cachedData && typeof cachedData === 'string') {
                return res.status(200).json(JSON.parse(cachedData));
            }
        } catch (redisError) {
            console.error("Redis error during fetchRound:", redisError);
            // Continue to Firestore if Redis fails
        }

        // If not in cache or Redis failed, fetch from Firestore
        const roundsRef = db.collection("companies").doc(companyId).collection("rounds");
        const snapshot = await roundsRef.get();

        if (snapshot.empty) {
            return res.status(404).json({
                message: "No rounds found for this company",
                status: false
            });
        }

        const rounds = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        const response = {
            success: true,
            rounds
        };

        // Try to set cache, but don't fail if Redis is unavailable
        try {
            const cacheKey = `rounds:${companyId}`;
            const jsonData = JSON.stringify(response);
            await redis.set(cacheKey, jsonData, { ex: CACHE_TTL.ROUNDS });
        } catch (redisError) {
            console.error("Redis error during cache setting:", redisError);
            // Continue execution even if Redis fails
        }

        return res.status(200).json(response);
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

export const fetchDashboardDetails = async (req, res) => {
    try {
        const userId = req.query.userId || req.headers["x-user-id"];

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: "User ID is required"
            });
        }

        // Try to get from cache, but don't fail if Redis is unavailable
        try {
            const cacheKey = `dashboard:${userId}`;
            const cachedData = await redis.get(cacheKey);

            // Only attempt to parse if cachedData exists and is a string
            if (cachedData && typeof cachedData === 'string') {
                return res.status(200).json(JSON.parse(cachedData));
            }
        } catch (redisError) {
            console.error("Redis error during fetchDashboardDetails:", redisError);
            // Continue to Firestore if Redis fails
        }

        // If not in cache or Redis failed, fetch from Firestore
        const companySnapshot = await db.collection("companies").where("userId", "==", userId).get();
        const totalCompanies = companySnapshot.size;

        let totalRounds = 0;

        // Fetch all rounds associated with user's companies
        for (const companyDoc of companySnapshot.docs) {
            const roundsSnapshot = await db.collection("companies").doc(companyDoc.id).collection("rounds").get();
            totalRounds += roundsSnapshot.size;
        }

        const response = {
            success: true,
            dashboardDetails: {
                totalCompanies,
                totalRounds
            }
        };

        // Try to set cache, but don't fail if Redis is unavailable
        try {
            const cacheKey = `dashboard:${userId}`;
            const jsonData = JSON.stringify(response);
            await redis.set(cacheKey, jsonData, { ex: CACHE_TTL.DASHBOARD });
        } catch (redisError) {
            console.error("Redis error during cache setting:", redisError);
            // Continue execution even if Redis fails
        }

        return res.status(200).json(response);
    } catch (error) {
        console.error("Error fetching dashboard details:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message
        });
    }
};