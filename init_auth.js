const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function main() {
    try {
        console.log("Refreshing token by listing firebase projects...");
        execSync('npx firebase projects:list', { stdio: 'inherit' });

        const configPath = path.join('C:', 'Users', 'HP', '.config', 'configstore', 'firebase-tools.json');
        if (!fs.existsSync(configPath)) {
            throw new Error(`firebase-tools.json not found at ${configPath}`);
        }

        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const accessToken = config.tokens?.access_token;
        if (!accessToken) {
            throw new Error("No access_token found in firebase-tools.json");
        }

        console.log("Token retrieved successfully. Initializing Identity Platform (Firebase Auth) via REST API...");

        const projectId = "radiostack-dev-67a8";
        const url = `https://identitytoolkit.googleapis.com/v2/projects/${projectId}/identityPlatform:initializeAuth`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
        });

        const data = await response.json();
        console.log("API Response Status:", response.status);
        console.log("API Response Body:", JSON.stringify(data, null, 2));

        if (response.ok) {
            console.log("Firebase Authentication/Identity Platform successfully initialized!");
        } else {
            console.error("Initialization failed.");
        }
    } catch (error) {
        console.error("Error running initialization:", error);
    }
}

main();
