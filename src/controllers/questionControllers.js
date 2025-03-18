import { generateInterviewQuestions } from "../ai/generate-questions.js";
import { db } from "../firebase/firebaseAdmin.js";
import admin from 'firebase-admin'

export const generateQuestions = async (req, res) => {
    try {
        const { companyId, roundId, roundName, difficulty, language } = req.body;

        if (!companyId || !roundId || !roundName || !difficulty || !language) {
            return res.status(400).json({
                message: "All fields are required",
                status: false,
            });
        }

        const batch = db.batch();
        const roundRef = db.collection("companies").doc(companyId).collection("rounds").doc(roundId);

        const question = await generateInterviewQuestions(roundName, difficulty, language);
        const cleanedResponse = question.replace(/```json\n|\n```/g, '').trim();
        const parsedQuestions = JSON.parse(cleanedResponse);
        
        const questionsArray = parsedQuestions.map((q) => {
            const questionRef = roundRef.collection("questions").doc();
            batch.set(questionRef, {
                ...q,
                roundId,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            return { id: questionRef.id, ...q }; 
        });

        await batch.commit();

        return res.status(200).json({
            success: true,
            message: "Questions generated successfully",
            roundId,
            questions: questionsArray, 
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const fetchQuestions = async (req, res)=> {
    try {
        const {companyId, roundId} = req.query; 
        if(!companyId || !roundId){
            return res.status(400).json({
                message: "Company Id and Round Id is required",
                status: false
            })
        }

        const questionRef = db.collection("companies").doc(companyId).collection("rounds").doc(roundId).collection("questions");
        const snapShot = await questionRef.orderBy("createdAt", "asc").get()
        const questions = snapShot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }))

        return res.status(200).json({
            success: true,
            questions
        })
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
}
