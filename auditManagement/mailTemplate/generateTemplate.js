// mailer/generateTemplate.js
import fs from 'fs'
import path from 'path'

import { fileURLToPath } from 'url';

// Simulate __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const generateTemplate = ({ variables, fileName }) => {
    try {
        const templatePath = path.join(__dirname, 'template', `${fileName}`);
        let html = fs.readFileSync(templatePath, 'utf8');

        Object.entries(variables).forEach(([key, value]) => {
            const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
            html = html.replace(regex, value);
        });

        if (!html) {
            throw new Error('HTML file is empty');
        }

        return html;
    } catch (error) {
        throw error
    }
};

export default generateTemplate;