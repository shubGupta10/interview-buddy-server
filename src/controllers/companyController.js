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

export const deleteCompany = async (req, res) => {
    try {
        const {userId, companyId} = req.body;
        if(!userId || !companyId){
            return res.status(400).json({
                message: "User is not authorized",
                status: false
            })
        }

        const companyRef = await db.collection("companies").doc(companyId);
        const companyDoc = await companyRef.get();

        if(!companyDoc.exists){
            return res.status(404).json({
                message: "Company not found",
                status: false
            })
        }

        if(companyDoc.data().userId !== userId){
            return res.status(403).json({
                message: "Unauthorized: You can only delete your own company",
                success: false
            })
        }

        await companyRef.delete();

        return res.status(200).json({
            message: "Company deleted successfully",
            success: true
        })
    } catch (error) {
        console.error("Error deleting company:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message
        });
    }
}

export const deleteRound = async (req, res) => {
    try {
        const {userId, companyId, roundId} = req.body;
        if(!userId || !companyId || !roundId){
            return res.status(404).json({
                message: "User is unauthorized",
                status: false
            })
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

        const roundRef = db.collection("companies").doc(companyId).collection("rounds").doc();
        await roundRef.set({
            roundName,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

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
        const { userId } = req.query; 

        if (!userId) {
            return res.status(400).json({
                message: "User ID is required",
                status: false
            });
        }

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

        return res.status(200).json({
            status: true,
            companies
        });
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

export const fetchDashboardDetails = async (req, res) => {
    try {
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: "User ID is required"
            });
        }

        // Fetch companies created by the user
        const companySnapshot = await db.collection("companies").where("userId", "==", userId).get();
        const totalCompanies = companySnapshot.size;

        let totalRounds = 0;

        // Fetch all rounds associated with user's companies
        for (const companyDoc of companySnapshot.docs) {
            const roundsSnapshot = await db.collection("companies").doc(companyDoc.id).collection("rounds").get();
            totalRounds += roundsSnapshot.size;
        }

        return res.status(200).json({
            success: true,
            dashboardDetails: {
                totalCompanies,
                totalRounds
            }
        });
    } catch (error) {
        console.error("Error fetching dashboard details:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message
        });
    }
};
