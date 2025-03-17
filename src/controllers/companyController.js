import { db } from "../firebase/firebaseAdmin.js";
import admin from "firebase-admin";

export const createCompany = async (req, res) => {
    try {
        const { userId, companyName } = req.body;
        if (!userId || !companyName) {
            return res.status(400).json({
                success: false,
                message: "User is not authorized"
            })
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


        const compnayRef = db.collection("companies").doc();
        await compnayRef.set({
            userId,
            companyName,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return res.status(200).json({
            success: true,
            companyId: compnayRef.id
        })
    } catch (error) {
        console.error("Error creating company:", error);
        res.status(500).json({ success: false, error: error.message });
    }
}

export const createRound = async (req, res) => {
    try {
        const { companyId, roundName } = req.body;
        if (!companyId || !roundName) {
            return res.status(404).json({
                message: "All fields are required",
                status: false,
            })
        }
        const roundRef = db.collection("companies").doc(companyId).collection("rounds").doc();
        await roundRef.set({
            roundName,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        })

        return res.status(200).json({
            success: true,
            roundId: roundRef.id
        })
    } catch (error) {
        console.error("Error creating round:", error);
        res.status(500).json({ success: false, error: error.message });
    }
}

export const fetchCompany = async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) {
            return res.status(404).json({
                message: "User is not authorized",
                status: false
            })
        }

        const companyRef = db.collection("companies");
        const snapShot = await companyRef.where("userId", "==", userId).get();

        if (snapShot.empty) {
            return res.status(404).json({
                message: "No companies found",
                status: false
            })
        }

        const companies = snapShot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }))

        return res.status(200).json({
            status: true,
            companies
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

export const fetchRound = async (req, res) => {
    try {
        const { companyId } = req.body;

        if (!companyId) {
            return res.status(400).json({
                message: "Company not found",
                status: false
            });
        }

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

        return res.status(200).json({
            success: true,
            rounds
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};