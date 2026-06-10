const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const projectId = "radiostack-dev-67a8";
const adminEmail = "admin@radiostack.com";
const adminPassword = "adminpassword123";

async function main() {
    try {
        const localKeyPath = path.join(__dirname, 'firebase-service-account.json');
        if (!fs.existsSync(localKeyPath)) {
            throw new Error(`firebase-service-account.json not found at ${localKeyPath}`);
        }
        
        const localKey = JSON.parse(fs.readFileSync(localKeyPath, 'utf8'));
        admin.initializeApp({
            credential: admin.credential.cert(localKey),
            projectId
        });

        console.log(`Checking if user ${adminEmail} already exists...`);
        let user;
        try {
            user = await admin.auth().getUserByEmail(adminEmail);
            console.log("Admin user already exists. Updating password...");
            await admin.auth().updateUser(user.uid, {
                password: adminPassword
            });
            console.log("Password updated successfully!");
        } catch (e) {
            if (e.code === 'auth/user-not-found') {
                console.log("Creating new admin user...");
                user = await admin.auth().createUser({
                    email: adminEmail,
                    password: adminPassword,
                    emailVerified: true,
                    displayName: "Admin"
                });
                console.log(`Successfully created admin user: ${user.email}`);
            } else {
                throw e;
            }
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

main();
