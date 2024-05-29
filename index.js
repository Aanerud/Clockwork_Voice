const express = require('express');
const bodyParser = require('body-parser');
const textToSpeech = require('@google-cloud/text-to-speech');
const { Ollama } = require('ollama');
const fs = require('fs');
const util = require('util');
const path = require('path');

const app = express();
const client = new textToSpeech.TextToSpeechClient();
const ollamaClient = new Ollama({ host: 'http://localhost:11434' });

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));

const port = 3000;

async function generateSSML(text, modelName='custom_voice_ssml') {
    const instructions = "You are an SSML generator optimized for commercial quality voice output. Please apply SSML tags to enhance the spoken version of the input text, ensuring it is suitable for professional presentations.";
    const messages = [
        { role: 'system', content: instructions },
        { role: 'user', content: text }
    ];

    const response = await ollamaClient.chat({
        model: modelName,
        messages: messages
    });
    return response.message.content;
}

async function synthesizeSpeechToWAV(ssml, outFile) {
    const request = {
        input: { ssml },
        voice: { languageCode: 'nb-NO', name: 'nb-NO-Standard-D' },
        audioConfig: { audioEncoding: 'LINEAR16' } // WAV format
    };

    const [response] = await client.synthesizeSpeech(request);
    await util.promisify(fs.writeFile)(outFile, response.audioContent, 'binary');
    console.log('Audio content written to:', outFile);
    return outFile;
}

app.post('/synthesize', async (req, res) => {
    const text = req.body.text;
    try {
        const ssml = await generateSSML(text);
        const outputPath = path.join(__dirname, 'public', 'output.wav');
        const filePath = await synthesizeSpeechToWAV(ssml, outputPath);
        res.json({ message: 'Audio processed and available.', ssml: ssml }); // Return SSML text for debugging
    } catch (error) {
        console.error('Error processing request:', error);
        res.status(500).json({ message: 'Failed to process request.', error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
