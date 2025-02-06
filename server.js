app.post('/generate-activity', async (req, res) => {
    try {
        const isSpicier = req.body.spicier || false;
        const baseActivity = req.body.activity || '';
        
        let prompt = isSpicier 
            ? `Make this activity more exciting and adventurous, but keep it safe and appropriate: "${baseActivity}". 
               Respond with just the spicier version - no explanations.`
            : `Generate a unique and specific activity suggestion. Be creative and detailed, but keep it under 150 characters.
               Respond with just the activity itself - no explanations or additional text.
               Example: "Create a miniature indoor zen garden with colored sand and tiny succulents"`;

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'anthropic-version': '2023-06-01',
                'x-api-key': process.env.CLAUDE_API_KEY
            },
            body: JSON.stringify({
                model: "claude-3-opus-20240229",
                max_tokens: 100,
                messages: [{
                    role: "user",
                    content: prompt
                }],
                temperature: 0.9
            })
        });

        const data = await response.json();
        res.json({ activity: data.content[0].text });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to generate activity' });
    }
});
