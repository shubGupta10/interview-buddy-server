import { generateInterviewQuestions } from "../ai/generate-questions.js";
import { db } from "../firebase/firebaseAdmin.js";
import admin from 'firebase-admin'

export const generateQuestions = async (req, res) => {
    try {
        const { companyId, roundId, roundName, difficulty, language } = req.body;

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

        const batch = db.batch();
        const roundRef = db.collection("companies").doc(companyId).collection("rounds").doc(roundId);

        const generatedAt = admin.firestore.FieldValue.serverTimestamp();

        const question = await generateInterviewQuestions(roundName, difficulty, language);
        const cleanedResponse = question.replace(/```json\n|\n```/g, '').trim();
        const parsedQuestions = JSON.parse(cleanedResponse);

        const questionsArray = parsedQuestions.map((q) => {
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

export const fetchQuestions = async (req, res) => {
    try {
        const { companyId, roundId, language } = req.query;

        if (!companyId || !roundId) {
            return res.status(400).json({
                success: false,
                message: "Company Id and Round Id are required",
            });
        }

        console.log("Fetching questions for:", { companyId, roundId, language });

        const questionRef = db
            .collection("companies")
            .doc(companyId)
            .collection("rounds")
            .doc(roundId)
            .collection("questions");

        let latestBatchQuery;

        // If language is provided, filter by language
        if (language) {
            latestBatchQuery = await questionRef
                .where("language", "==", language)
                .orderBy("generatedAt", "desc")
                .limit(1)
                .get();
        } else {
            // If language is NOT provided, fetch latest questions without language filter
            latestBatchQuery = await questionRef
                .orderBy("generatedAt", "desc")
                .limit(1)
                .get();
        }

        if (latestBatchQuery.empty) {
            console.log("No questions found for the given criteria.");
            return res.status(200).json({ success: true, questions: [] });
        }

        const latestGeneratedAt = latestBatchQuery.docs[0].data().generatedAt;

        let snapShot;

        // Fetch all questions with the latest generatedAt
        if (language) {
            snapShot = await questionRef
                .where("language", "==", language)
                .where("generatedAt", "==", latestGeneratedAt)
                .get();
        } else {
            snapShot = await questionRef
                .where("generatedAt", "==", latestGeneratedAt)
                .get();
        }

        const questions = snapShot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }));

        console.log("Fetched Questions:", questions);

        return res.status(200).json({
            success: true,
            questions,
        });
    } catch (error) {
        console.error("Error fetching questions:", error.stack || error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message,
        });
    }
};

export const fetchRounds = async (req, res) => {
    try {
        const { companyId } = req.query;
        
        if (!companyId) {
            return res.status(400).json({
                success: false,
                message: "Company ID is required",
            });
        }

        const roundsSnapshot = await db
            .collection("companies")
            .doc(companyId)
            .collection("rounds")
            .orderBy("createdAt", "desc")
            .get();

        if (roundsSnapshot.empty) {
            return res.status(200).json({ success: true, rounds: [] });
        }

        const rounds = roundsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        
        return res.status(200).json({ success: true, rounds });
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

        if (questionsSnapshot.empty) {
            return res.status(200).json({ success: true, questions: [] });
        }

        const questions = questionsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        
        return res.status(200).json({ success: true, questions });
    } catch (error) {
        console.error("Error fetching questions:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message,
        });
    }
};


