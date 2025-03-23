import generateInterviewQuestions from '../ai/generate-questions.js'
import { db } from "../firebase/firebaseAdmin.js";
import admin from 'firebase-admin'
import explainQuestionAnsDeeply from '../ai/explain-questions.js';
import redis from '../redis/redis.js';
import moment from "moment";

const CACHE_TTL = {
    QUESTIONS: 1800, // 30 minutes
    ROUNDS: 3600,    // 1 hour
    RATE_LIMIT: 21600 // 6 hours
};

export const generateQuestions = async (req, res) => {
    try {
        const { userId, companyId, roundId, roundName, difficulty, language } = req.body;

        if (!userId) {
            return res.status(400).json({ message: "User ID is required", status: false });
        }

        const roundsWithoutLanguage = ["Behavioral Interview", "HR Round", "Managerial Round"];

        if (!companyId || !roundId || !roundName || !difficulty) {
            return res.status(400).json({
                message: "All fields except language are required",
                status: false,
            });
        }

        if (roundsWithoutLanguage.includes(roundName) && language) {
            return res.status(400).json({
                message: `${roundName} does not require a programming language.`,
                status: false,
            });
        }

        if (!roundsWithoutLanguage.includes(roundName) && !language) {
            return res.status(400).json({
                message: `${roundName} requires a programming language.`,
                status: false,
            });
        }

        const redisKey = `rate_limit:${userId}`;
        let requestCount = 0;

        try {
            requestCount = Number(await redis.get(redisKey)) || 0;

            if (requestCount >= 5) {
                return res.status(429).json({
                    message: "You have reached the limit of 5 requests per 6 hours. Please try again later.",
                    status: false,
                });
            }

            if (requestCount === 0) {
                await redis.set(redisKey, 1, { ex: CACHE_TTL.RATE_LIMIT });
            } else {
                await redis.incr(redisKey);
            }
        } catch (redisError) {
            console.error("Redis error during rate limiting:", redisError);
            // Continue execution even if Redis fails
        }

        const batch = db.batch();
        const roundRef = db.collection("companies").doc(companyId).collection("rounds").doc(roundId);

        const generatedAt = admin.firestore.FieldValue.serverTimestamp();
        const question = await generateInterviewQuestions(roundName, difficulty, language);

        const questionsArray = question.map((q) => {
            const questionRef = roundRef.collection("questions").doc();
            batch.set(questionRef, {
                ...q,
                roundId,
                ...(language && { language }),
                createdAt: generatedAt,
                generatedAt: generatedAt
            });
            return { id: questionRef.id, ...q };
        });

        await batch.commit();

        // Invalidate cache for questions in this round
        try {
            // Invalidate specific question caches
            await redis.del(`questions:${companyId}:${roundId}`);
            if (language) {
                await redis.del(`questions:${companyId}:${roundId}:${language}`);
            }
            if (difficulty) {
                await redis.del(`questions:${companyId}:${roundId}:difficulty:${difficulty}`);
            }
            if (language && difficulty) {
                await redis.del(`questions:${companyId}:${roundId}:${language}:${difficulty}`);
            }
        } catch (redisError) {
            console.error("Redis error during cache invalidation:", redisError);
            // Continue execution even if Redis fails
        }

        return res.status(200).json({
            success: true,
            message: "Questions generated successfully",
            roundId,
            ...(language && { language }),
            questions: questionsArray,
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const deleteQuestionsByRound = async (req, res) => {
    try {
        const { roundId, companyId } = req.body;
        if (!roundId || !companyId) {
            return res.status(400).json({
                message: "Round ID and Company ID are required",
                status: false
            })
        }

        const roundRef = db.collection("companies").doc(companyId).collection("rounds").doc(roundId);
        const questionRef = roundRef.collection("questions");

        const snapShot = await questionRef.get();
        if (snapShot.empty) {
            return res.status(404).json({
                message: "No questions found for this round",
                status: false
            })
        }
        const batch = db.batch();
        snapShot.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();

        try {
            await redis.del(`questions:${companyId}:${roundId}`);
        } catch (redisError) {
            console.error("Redis cache deletion error:", redisError);
        }

        return res.status(200).json({
            message: "All questions deleted successfully",
            status: true
        })
    } catch (error) {
        return res.status(500).json({ message: error.message, success: false });
    }
}

export const deleteQuestionByLanguage = async (req, res) => {
    try {
        const { companyId, roundId, language } = req.body;
        if (!companyId || !roundId || !language) {
            return res.status(400).json({
                message: "Company ID, Round ID and Language are required",
                status: false
            })
        }

        const questionRef = db.collection("companies").doc(companyId).collection("rounds").doc(roundId).collection("questions");
        const snapShot = await questionRef.where("language", "==", language).get();

        if(snapShot.empty){
            return res.status(404).json({
                message: "No questions found for this language",
                status: false
            })
        }

        const batch = db.batch();
        snapShot.forEach(doc => {
            batch.delete(doc.ref);
        })
        await batch.commit();

        try {
            await redis.del(`questions:${companyId}:${roundId}`);
        } catch (error) {
            console.error("Redis cache deletion error:", redisError);
        }

        return res.status(200).json({
            message: "All questions deleted successfully",
            status: true
        })
    } catch (error) {
        return res.status(500).json({ message: error.message, success: false });
    }



}

export const deleteQuestionByDifficulty = async (req, res) => {
    try {
        const {companyId, roundId, difficulty} = req.body;
        if(!companyId || !roundId || !difficulty){
            return res.status(400).json({
                message: "Company ID, Round ID and Difficulty are required",
                status: false
            })
        }

        const questionRef = db.collection("companies").doc(companyId).collection("rounds").doc(roundId).collection("questions");
        const snapShot = await questionRef.where("difficulty", "==", difficulty).get();
        if(snapShot.empty){
            return res.status(404).json({
                message: "No questions found for this difficulty",
                status: false
            })
        }

        const batch = db.batch();
        snapShot.forEach(doc => {
            batch.delete(doc.ref);
        })
        await batch.commit();

        try {
            redis.del(`questions:${companyId}:${roundId}`);
        } catch (error) {
            console.error("Redis cache deletion error:", redisError);
        }

        return res.status(200).json({
            message: "All questions deleted successfully",
            status: true
        })
    } catch (error) {
        return res.status(500).json({ message: error.message, success: false });
    }
}

export const fetchQuestions = async (req, res) => {
    try {
        const { companyId, roundId, language } = req.query;

        if (!companyId || !roundId) {
            return res.status(400).json({
                success: false,
                message: "Company Id and Round Id are required",
            });
        }

        let cachedData = null;
        // Try to get from cache, but don't fail if Redis is unavailable
        try {
            const cacheKey = language
                ? `questions:${companyId}:${roundId}:${language}`
                : `questions:${companyId}:${roundId}`;

            cachedData = await redis.get(cacheKey);
            if (cachedData) {
                try {
                    // Check if it's a string before parsing
                    if (typeof cachedData === 'string') {
                        const parsedData = JSON.parse(cachedData);
                        return res.status(200).json(parsedData);
                    } else {
                        // It's already an object, use directly
                        return res.status(200).json(cachedData);
                    }
                } catch (parseError) {
                    console.error("Error parsing Redis data:", parseError);
                    // Continue to Firestore if parsing fails
                }
            }
        } catch (redisError) {
            console.error("Redis error during fetchQuestions:", redisError);
            // Continue to Firestore if Redis fails
        }

        const questionRef = db
            .collection("companies")
            .doc(companyId)
            .collection("rounds")
            .doc(roundId)
            .collection("questions");

        let query;

        // If language is provided, filter by language
        if (language) {
            query = questionRef
                .where("language", "==", language)
                .orderBy("generatedAt", "desc")
                .limit(20);
        } else {
            query = questionRef
                .orderBy("generatedAt", "desc")
                .limit(20);
        }

        const snapShot = await query.get();

        const questions = snapShot.empty ? [] : snapShot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }));

        const response = {
            success: true,
            questions,
        };

        // Try to set cache, but don't fail if Redis is unavailable
        try {
            const cacheKey = language
                ? `questions:${companyId}:${roundId}:${language}`
                : `questions:${companyId}:${roundId}`;

            // Ensure we're storing a JSON string
            const jsonData = JSON.stringify(response);
            await redis.set(cacheKey, jsonData, { ex: CACHE_TTL.QUESTIONS });
        } catch (redisError) {
            console.error("Redis error during cache setting:", redisError);
            // Continue execution even if Redis fails
        }

        return res.status(200).json(response);
    } catch (error) {
        console.error("Error fetching questions:", error.stack || error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message,
        });
    }
}

export const fetchRounds = async (req, res) => {
    try {
        const { companyId } = req.query;

        if (!companyId) {
            return res.status(400).json({
                success: false,
                message: "Company ID is required",
            });
        }

        let cachedData = null;
        // Try to get from cache, but don't fail if Redis is unavailable
        try {
            const cacheKey = `rounds:${companyId}`;
            cachedData = await redis.get(cacheKey);
            if (cachedData) {
                try {
                    // Check if it's a string before parsing
                    if (typeof cachedData === 'string') {
                        const parsedData = JSON.parse(cachedData);
                        return res.status(200).json(parsedData);
                    } else {
                        // It's already an object, use directly
                        return res.status(200).json(cachedData);
                    }
                } catch (parseError) {
                    console.error("Error parsing Redis data:", parseError);
                    // Continue to Firestore if parsing fails
                }
            }
        } catch (redisError) {
            console.error("Redis error during fetchRounds:", redisError);
        }

        const roundsSnapshot = await db
            .collection("companies")
            .doc(companyId)
            .collection("rounds")
            .orderBy("createdAt", "desc")
            .get();

        const rounds = roundsSnapshot.empty ? [] : roundsSnapshot.docs.map((doc) => ({
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
            // Ensure we're storing a JSON string
            const jsonData = JSON.stringify(response);
            await redis.set(cacheKey, jsonData, { ex: CACHE_TTL.ROUNDS });
        } catch (redisError) {
            console.error("Redis error during cache setting:", redisError);
            // Continue execution even if Redis fails
        }

        return res.status(200).json(response);
    } catch (error) {
        console.error("Error fetching rounds:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message,
        });
    }
};

export const fetchQuestionsByRound = async (req, res) => {
    try {
        const { companyId, roundId, language, difficulty } = req.query;

        if (!companyId || !roundId) {
            return res.status(400).json({
                success: false,
                message: "Company ID and Round ID are required",
            });
        }

        let cachedData = null;
        // Try to get from cache, but don't fail if Redis is unavailable
        try {
            let cacheKey = `questions:${companyId}:${roundId}`;
            if (language && difficulty) {
                cacheKey = `questions:${companyId}:${roundId}:${language}:${difficulty}`;
            } else if (language) {
                cacheKey = `questions:${companyId}:${roundId}:${language}`;
            } else if (difficulty) {
                cacheKey = `questions:${companyId}:${roundId}:difficulty:${difficulty}`;
            }

            cachedData = await redis.get(cacheKey);
            if (cachedData) {
                try {
                    // Check if it's a string before parsing
                    if (typeof cachedData === 'string') {
                        const parsedData = JSON.parse(cachedData);
                        return res.status(200).json(parsedData);
                    } else {
                        // It's already an object, use directly
                        return res.status(200).json(cachedData);
                    }
                } catch (parseError) {
                    console.error("Error parsing Redis data:", parseError);
                    // Continue to Firestore if parsing fails
                }
            }
        } catch (redisError) {
            console.error("Redis error during fetchQuestionsByRound:", redisError);
            // Continue to Firestore if Redis fails
        }

        let query = db
            .collection("companies")
            .doc(companyId)
            .collection("rounds")
            .doc(roundId)
            .collection("questions")
            .orderBy("generatedAt", "desc");

        if (language) {
            query = query.where("language", "==", language);
        }

        if (difficulty) {
            query = query.where("difficulty", "==", difficulty);
        }

        const questionsSnapshot = await query.get();

        const questions = questionsSnapshot.empty ? [] : questionsSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data()
        }));

        const response = {
            success: true,
            questions
        };

        // Try to set cache, but don't fail if Redis is unavailable
        try {
            let cacheKey = `questions:${companyId}:${roundId}`;
            if (language && difficulty) {
                cacheKey = `questions:${companyId}:${roundId}:${language}:${difficulty}`;
            } else if (language) {
                cacheKey = `questions:${companyId}:${roundId}:${language}`;
            } else if (difficulty) {
                cacheKey = `questions:${companyId}:${roundId}:difficulty:${difficulty}`;
            }

            // Ensure we're storing a JSON string
            const jsonData = JSON.stringify(response);
            await redis.set(cacheKey, jsonData, { ex: CACHE_TTL.QUESTIONS });
        } catch (redisError) {
            console.error("Redis error during cache setting:", redisError);
            // Continue execution even if Redis fails
        }

        return res.status(200).json(response);
    } catch (error) {
        console.error("Error fetching questions:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message,
        });
    }
};

export const explainQuestion = async (req, res) => {
    try {

        const { questionId, question, userId } = req.body;
        if (!questionId || !question) {
            return res.status(400).json({
                message: "Question ID and question are required.",
                status: 400
            });
        }

        if (!userId) {
            return res.status(404).json({
                message: "User not found",
                status: false
            })
        }

        let cachedData = null;
        // Try to get from cache, but don't fail if Redis is unavailable
        try {
            const cacheKey = `explanation:${questionId}`;
            cachedData = await redis.get(cacheKey);
            if (cachedData) {
                try {
                    // Check if it's a string before parsing
                    if (typeof cachedData === 'string') {
                        const parsedData = JSON.parse(cachedData);
                        return res.status(200).json(parsedData);
                    } else {
                        // It's already an object, use directly
                        return res.status(200).json(cachedData);
                    }
                } catch (parseError) {
                    console.error("Error parsing Redis data:", parseError);
                    // Continue if parsing fails
                }
            }
        } catch (redisError) {
            console.error("Redis error during explainQuestion:", redisError);
            // Continue if Redis fails
        }

        const explanation = await explainQuestionAnsDeeply(question);

        const response = {
            message: "Explanation generated successfully.",
            explanation,
            status: 200
        };

        // Try to set cache, but don't fail if Redis is unavailable
        try {
            const cacheKey = `explanation:${questionId}`;
            // Ensure we're storing a JSON string
            const jsonData = JSON.stringify(response);
            await redis.set(cacheKey, jsonData, { ex: CACHE_TTL.QUESTIONS });
        } catch (redisError) {
            console.error("Redis error during cache setting:", redisError);
            // Continue execution even if Redis fails
        }

        return res.status(200).json(response);
    } catch (error) {
        console.error("Error generating explanation:", error);
        return res.status(500).json({
            message: "Failed to generate explanation.",
            error: error.message,
            status: 500
        });
    }
}

export const trackGenerationLimit = async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ message: "User ID is required", status: false });
        }

        const redisKey = `rate_limit:${userId}`;
        let requestCount = 0;
        let ttl = 0;

        // Try to get from Redis, but don't fail if Redis is unavailable
        try {
            requestCount = Number(await redis.get(redisKey)) || 0;
            ttl = await redis.ttl(redisKey);
        } catch (redisError) {
            console.error("Redis error during trackGenerationLimit:", redisError);
            // Continue execution with default values if Redis fails
        }

        const timeLeft = ttl > 0 ? moment.duration(ttl, "seconds").humanize() : "Now";

        return res.status(200).json({
            success: true,
            message: "Generation limit status retrieved successfully",
            used: requestCount,
            remaining: Math.max(0, 5 - requestCount),
            resetIn: timeLeft
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};