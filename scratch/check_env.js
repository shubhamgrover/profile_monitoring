console.log("GEMINI_API_KEY:", process.env.GEMINI_API_KEY ? "Found" : "Not Found");
console.log("Available Env keys:", Object.keys(process.env).filter(k => k.includes("API") || k.includes("KEY") || k.includes("GEMINI")));
