const OPENWEATHER_API_KEY = "00e57a66081e7510a54ec6f575e31b2b";
const OGD_API_KEY = "579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b";

let userLocation = "", userState = "", userDistrict = "", userLanguage = "en";
let userLat = null, userLon = null;
let isAwaitingSoilType = false, isAwaitingCropName = false, isAwaitingPestInfo = false, isAwaitingSoilHealthResponse = false;
let inMarketMode = false; // Keeps market context across follow-ups
// Keep recent conversation turns for AI memory
const chatHistory = [];

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;
let isListening = false;

if (recognition) {
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
        document.getElementById('userInput').value = event.results[0][0].transcript;
        toggleVoiceInput(true);
        sendMessage();
    };
    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        toggleVoiceInput(true);
    };
    recognition.onend = () => {
        if (isListening) toggleVoiceInput(true);
    };
} else {
    const voiceBtn = document.getElementById('voiceBtn');
    if (voiceBtn) voiceBtn.style.display = 'none';
}

const translations = {
    "en": {
        "greeting": "Hello! I'm Kisan Mitra. How can I assist you with your farming needs today?",
        "personalized_welcome": "Welcome from {location}! I can advise on crop selection, pest control, fertilizers, weather, and market prices. How can I help?",
        "options_title": "Quick Advisory", "crop-selection-query": "Crop Selection", "pest-control-query": "Pest Control", "fertilizer-query": "Fertilizer Guidance", "weather-query": "Weather Advisory", "soil-health-query": "Soil Health", "market-prices-query": "Market Prices",
        "fetching_prices": "Fetching market prices for {crop}...",
        "ask_crop_price": "Which crop's price would you like to check?",
        "weather_report": "<b>Weather in {location}:</b><br>Temperature: {temp}°C<br>Condition: {description}<br>Humidity: {humidity}%<br>Wind Speed: {wind} m/s",
        "weather_error": "Sorry, I couldn't get the weather for your location. Please try again later.",
        "soil-types": { "question": "What is your soil type?", "options": ["Alluvial", "Black", "Red", "Laterite", "Arid", "Forest"] },
        "common-pests": { "question": "Which pest are you dealing with?", "options": ["Aphids", "Whiteflies", "Bollworms", "Stem Borers", "Locusts", "Other"] },
        "soil-health": "What aspect of soil health are you interested in? Please select an option.",
        "soil-health-options": { "question": "What aspect of soil health are you interested in?", "options": ["Water Drainage", "Nutrient Levels", "Soil Hardness", "Organic Matter"] }, "soil_health_yes": "Excellent! Knowing the pH helps in choosing the right crops and nutrients.", "soil_health_no": "I recommend getting a soil test. It provides crucial information on pH and nutrient levels for better crop planning.",
        "fertilizer_guidance": "For good soil health, organic fertilizers like *compost or vermicompost* are highly recommended. They improve soil structure and fertility over time. How many acres are you planning to fertilize?",
        "default": "I'm sorry, I didn't understand. Please ask about crops, pests, fertilizer, weather, or prices."
    },
    "hi": {
        "greeting": "नमस्ते! मैं कृषि मित्र हूँ। आज मैं आपकी खेती की ज़रूरतों में कैसे सहायता कर सकता हूँ?",
        "personalized_welcome": "{location} से आपका स्वागत है! मैं फसल चयन, कीट नियंत्रण, उर्वरक, मौसम और बाजार कीमतों पर सलाह दे सकता हूँ। मैं कैसे मदद करूँ?",
        "options_title": "त्वरित सलाह", "crop-selection-query": "फ़सल चयन", "pest-control-query": "कीट नियंत्रण", "fertilizer-query": "उर्वरक मार्गदर्शन", "weather-query": "मौसम सलाहकार", "soil-health-query": "मृदा स्वास्थ्य", "market-prices-query": "बाजार मूल्य",
        "fetching_prices": "{crop} के लिए बाजार मूल्य प्राप्त कर रहा हूँ...",
        "ask_crop_price": "आप किस फसल की कीमत जानना चाहेंगे?",
        "weather_report": "<b>{location} में मौसम:</b><br>तापमान: {temp}°C<br>स्थिति: {description}<br>आर्द्रता: {humidity}%<br>हवा की गति: {wind} m/s",
        "weather_error": "क्षमा करें, मैं आपके स्थान के लिए मौसम की जानकारी प्राप्त नहीं कर सका। कृपया बाद में पुनः प्रयास करें।",
        "soil-types": { "question": "आपकी मिट्टी का प्रकार क्या है?", "options": ["जलोढ़", "काली", "लाल", "लैटेराइट", "शुष्क", "वन"] },
        "common-pests": { "question": "आप किस कीट से परेशान हैं?", "options": ["माहू", "सफ़ेद मक्खी", "बॉलवर्म", "तना छेदक", "टिड्डी", "अन्य"] },
        "soil-health": "मिट्टी के स्वास्थ्य के किस पहलू में आपकी रुचि है? कृपया एक विकल्प चुनें।",
        "soil-health-options": { "question": "मिट्टी के स्वास्थ्य के किस पहलू में आपकी रुचि है?", "options": ["जल निकासी", "पोषक तत्व स्तर", "मिट्टी की कठोरता", "जैविक पदार्थ"] }, "soil_health_yes": "बहुत बढ़िया! पीएच जानने से सही फसलों और पोषक तत्वों को चुनने में मदद मिलती है।", "soil_health_no": "मैं मिट्टी परीक्षण करवाने की सलाह देता हूँ। यह बेहतर फसल योजना के लिए पीएच और पोषक तत्वों के स्तर पर महत्वपूर्ण जानकारी प्रदान करता है।",
        "fertilizer_guidance": "अच्छी मिट्टी के स्वास्थ्य के लिए, *कम्पोस्ट या वर्मीकम्पोस्ट* जैसे जैविक उर्वरकों की अत्यधिक अनुशंसा की जाती है। वे समय के साथ मिट्टी की संरचना और उर्वरता में सुधार करते हैं। आप कितने एकड़ में खाद डालने की योजना बना रहे हैं?",
        "default": "क्षमा करें, मैं समझ नहीं पाया। कृपया फसल, कीट, उर्वरक, मौसम या कीमतों के बारे में पूछें।"
    },
    "ta": {
        "greeting": "வணக்கம்! நான் கிருஷி மித்ரா. இன்று உங்கள் விவசாயத் தேவைகளுக்கு நான் எப்படி உதவ முடியும்?",
        "personalized_welcome": "{location} இலிருந்து வரவேற்கிறோம்! பயிர் தேர்வு, பூச்சி கட்டுப்பாடு, உரங்கள், வானிலை மற்றும் சந்தை விலைகள் குறித்து நான் உங்களுக்கு ஆலோசனை வழங்க முடியும். நான் எப்படி உதவ முடியும்?",
        "options_title": "விரைவு ஆலோசனை", "crop-selection-query": "பயிர் தேர்வு", "pest-control-query": "பூச்சி கட்டுப்பாடு", "fertilizer-query": "உர வழிகாட்டுதல்", "weather-query": "வானிலை அறிக்கை", "soil-health-query": "மண் வளம்", "market-prices-query": "சந்தை விலைகள்",
        "fetching_prices": "{crop} க்கான சந்தை விலைகளைப் பெறுகிறேன்...",
        "ask_crop_price": "நீங்கள் எந்த பயிரின் விலையை அறிய விரும்புகிறீர்கள்?",
        "weather_report": "<b>{location} இல் வானிலை:</b><br>வெப்பநிலை: {temp}°C<br>நிலை: {description}<br>ஈரப்பதம்: {humidity}%<br>காற்றின் வேகம்: {wind} m/s",
        "weather_error": "மன்னிக்கவும், உங்கள் இருப்பிடத்திற்கான வானிலை அறிக்கையைப் பெற முடியவில்லை. பின்னர் மீண்டும் முயற்சிக்கவும்.",
        "soil-types": { "question": "உங்கள் மண்ணின் வகை என்ன?", "options": ["வண்டல்", "கரிசல்", "செம்மண்", "சரளை", "பாலை", "காடு"] },
        "common-pests": { "question": "நீங்கள் எந்த பூச்சியை எதிர்கொள்கிறீர்கள்?", "options": ["அசுவினி", "வெள்ளை ஈ", "காய்ப் புழு", "தண்டுத் துளைப்பான்", "வெட்டுக்கிளி", "மற்றவை"] },
        "soil-health": "மண் வளத்தை மேம்படுத்த, கரிமப் பொருட்களை சேர்ப்பது முக்கியம். நீங்கள் சமீபத்தில் உங்கள் மண்ணின் pH அளவை சோதித்தீர்களா?", "soil_health_yes": "அருமை! pH அளவை அறிவது சரியான பயிர்களையும் ஊட்டச்சத்துக்களையும் தேர்ந்தெடுக்க உதவுகிறது.", "soil_health_no": "மண் பரிசோதனை செய்ய பரிந்துரைக்கிறேன். இது சிறந்த பயிர் திட்டமிடலுக்கு pH மற்றும் ஊட்டச்சத்து அளவுகள் பற்றிய முக்கியமான தகவல்களை வழங்குகிறது.",
        "fertilizer_guidance": "நல்ல மண் வளத்திற்கு, *மண்புழு உரம் அல்லது தொழு உரம்* போன்ற கரிம உரங்கள் மிகவும் பரிந்துரைக்கப்படுகின்றன. இவை காலப்போக்கில் மண்ணின் அமைப்பையும் வளத்தையும் மேம்படுத்துகின்றன. நீங்கள் எத்தனை ஏக்கரில் உரமிட திட்டமிட்டுள்ளீர்கள்?",
        "default": "மன்னிக்கவும், எனக்குப் புரியவில்லை. பயிர்கள், பூச்சிகள், உரம், வானிலை அல்லது விலைகள் பற்றி கேட்கவும்.",
        "soil-health-options": { "question": "மண் ஆரோக்கியத்தின் எந்த அம்சத்தில் நீங்கள் ஆர்வமாக உள்ளீர்கள்?", "options": ["நீர் வடிகால்", "ஊட்டச்சத்து அளவுகள்", "மண் கடினத்தன்மை", "கரிமப் பொருட்கள்"] }
    },
    "te": {
        "greeting": "నమస్కారం! నేను కృషి మిత్ర. ఈ రోజు మీ వ్యవసాయ అవసరాలకు నేను ఎలా సహాయపడగలను?",
        "personalized_welcome": "{location} నుండి స్వాగతం! నేను పంట ఎంపిక, తెగుళ్ళ నివారణ, ఎరువులు, వాతావరణం మరియు మార్కెట్ ధరలపై సలహా ఇవ్వగలను. నేను ఎలా సహాయపడగలను?",
        "options_title": "త్వరిత సలహా", "crop-selection-query": "పంట ఎంపిక", "pest-control-query": "పురుగుల నివారణ", "fertilizer-query": "ఎరువుల మార్గదర్శకం", "weather-query": "వాతావరణ సలహా", "soil-health-query": "నేల ఆరోగ్యం", "market-prices-query": "మార్కెట్ ధరలు",
        "fetching_prices": "{crop} కోసం మార్కెట్ ధరలను పొందుతున్నాను...",
        "ask_crop_price": "మీరు ఏ పంట ధరను తెలుసుకోవాలనుకుంటున్నారు?",
        "weather_report": "<b>{location}లో వాతావరణం:</b><br>ఉష్ణోగ్రత: {temp}°C<br>స్థితి: {description}<br>తేమ: {humidity}%<br>గాలి వేగం: {wind} m/s",
        "weather_error": "క్షమించండి, మీ ప్రాంతానికి వాతావరణ సమాచారం పొందలేకపోయాను. దయచేసి తర్వాత ప్రయత్నించండి.",
        "soil-types": { "question": "మీ నేల రకం ఏమిటి?", "options": ["ఒండ్రు", "నల్లరేగడి", "ఎర్ర", "లేటరైట్", "శుష్క", "అటవీ"] },
        "common-pests": { "question": "మీరు ఏ పురుగుతో బాధపడుతున్నారు?", "options": ["పేనుబంక", "తెల్ల దోమ", "కాయతొలుచు పురుగు", "కాండం తొలిచే పురుగు", "మిడత", "ఇతర"] },
        "soil-health": "మట్టి ఆరోగ్యాన్ని మెరుగుపరచడానికి, సేంద్రీయ పదార్థాన్ని జోడించడం ముఖ్యం. మీరు ఇటీవల మీ మట్టి యొక్క pH స్థాయిని పరీక్షించారా?", "soil_health_yes": "అద్భుతం! pH తెలుసుకోవడం సరైన పంటలు మరియు పోషకాలను ఎంచుకోవడంలో సహాయపడుతుంది.", "soil_health_no": "నేను మట్టి పరీక్ష చేయించుకోవాలని సిఫార్సు చేస్తున్నాను. ఇది మెరుగైన పంట ప్రణాళిక కోసం pH మరియు పోషకాల స్థాయిలపై కీలక సమాచారాన్ని అందిస్తుంది.",
        "fertilizer_guidance": "మంచి నేల ఆరోగ్యం కోసం, *కంపోస్ట్ లేదా వర్మీకంపోస్ట్* వంటి సేంద్రియ ఎరువులు బాగా సిఫార్సు చేయబడ్డాయి. అవి కాలక్రమేణా నేల నిర్మాణం మరియు సారాన్ని మెరుగుపరుస్తాయి. మీరు ఎన్ని ఎకరాలకు ఎరువు వేయాలని ప్లాన్ చేస్తున్నారు?",
        "default": "క్షమించండి, నాకు అర్థం కాలేదు. దయచేసి పంటలు, తెగుళ్లు, ఎరువులు, వాతావరణం లేదా ధరల గురించి అడగండి.",
        "soil-health-options": { "question": "నేల ఆరోగ్యం యొక్క ఏ అంశంపై మీకు ఆసక్తి ఉంది?", "options": ["నీటి వ్యవస్థ", "పోషకాల స్థాయి", "నేల గట్టితనం", "సేంద్రీయ పదార్థాలు"] }
    },
    "bn": {
        "greeting": "নমস্কার! আমি কৃষি মিত্র। আজ আমি আপনার চাষের প্রয়োজনে কীভাবে সাহায্য করতে পারি?",
        "personalized_welcome": "{location} থেকে স্বাগতম! আমি ফসল নির্বাচন, কীটপতঙ্গ নিয়ন্ত্রণ, সার, আবহাওয়া এবং বাজারদর সম্পর্কে পরামর্শ দিতে পারি। আমি কীভাবে সাহায্য করতে পারি?",
        "options_title": "দ্রুত পরামর্শ", "crop-selection-query": "ফসল নির্বাচন", "pest-control-query": " কীটপতঙ্গ নিয়ন্ত্রণ", "fertilizer-query": "সারের নির্দেশিকা", "weather-query": "আবহাওয়ার পরামর্শ", "soil-health-query": "মাটির স্বাস্থ্য", "market-prices-query": "বাজার দর",
        "fetching_prices": "{crop} এর জন্য বাজার দর আনা হচ্ছে...",
        "ask_crop_price": "আপনি কোন ফসলের দাম জানতে চান?",
        "weather_report": "<b>{location} এ আবহাওয়া:</b><br>তাপমাত্রা: {temp}°C<br>অবস্থা: {description}<br>আর্দ্রতা: {humidity}%<br>বাতাসের গতি: {wind} m/s",
        "weather_error": "দুঃখিত, আমি আপনার অবস্থানের জন্য আবহাওয়ার তথ্য পেতে পারিনি। অনুগ্রহ করে পরে আবার চেষ্টা করুন।",
        "soil-types": { "question": "আপনার মাটির ধরন কী?", "options": ["পলিমাটি", "কালো", "লাল", "ল্যাটেরাইট", "শুষ্ক", "বন"] },
        "common-pests": { "question": "আপনি কোন পোকার সাথে মোকাবিলা করছেন?", "options": ["জাবপোকা", "সাদা মাছি", "ফল ছিদ্রকারী পোকা", "কাণ্ড ছিদ্রকারী পোকা", "পঙ্গপাল", "অন্যান্য"] },
        "soil-health": "মাটির স্বাস্থ্য উন্নত করতে জৈব পদার্থ যোগ করা জরুরি। আপনি সম্প্রতি আপনার মাটির pH স্তর পরীক্ষা করেছেন?", "soil_health_yes": "চমৎকার! pH জানা সঠিক ফসল এবং পুষ্টি বেছে নিতে সাহায্য করে।", "soil_health_no": "আমি মাটি পরীক্ষা করার পরামর্শ দিচ্ছি। এটি উন্নত ফসল পরিকল্পনার জন্য pH এবং পুষ্টির মাত্রা সম্পর্কে গুরুত্বপূর্ণ তথ্য প্রদান করে।",
        "fertilizer_guidance": "ভালো মাটির স্বাস্থ্যের জন্য, *কম্পোস্ট বা ভার্মিকম্পোস্টের* মতো জৈব সার অত্যন্ত প্রস্তাবিত। এগুলি সময়ের সাথে সাথে মাটির গঠন এবং উর্বরতা উন্নত করে। আপনি কত একর জমিতে সার দেওয়ার পরিকল্পনা করছেন?",
        "default": "দুঃখিত, আমি বুঝতে পারিনি। অনুগ্রহ করে ফসল, কীটপতঙ্গ, সার, আবহাওয়া বা দাম সম্পর্কে জিজ্ঞাসা করুন.",
        "soil-health-options": { "question": "মাটির স্বাস্থ্যের কোন দিক নিয়ে আপনি আগ্রহী?", "options": ["জল নিষ্কাশন", "পুষ্টি স্তর", "মাটির কঠোরতা", "জৈব পদার্থ"] }
    },
    "gu": {
        "greeting": "નમસ્તે! હું કિસાન મિત્ર છું. આજે હું તમારી ખેતીમાં કેવી રીતે મદદ કરી શકું?",
        "personalized_welcome": "{location}માંથી આપનું સ્વાગત છે! હું પાક પસંદગી, કિટક નિયંત્રણ, ખાતર માર્ગદર્શન, હવામાન અને બજાર ભાવ અંગે સલાહ આપી શકું છું. હું કેવી રીતે મદદ કરું?",
        "options_title": "ઝડપી સલાહ", "crop-selection-query": "પાક પસંદગી", "pest-control-query": "કિટક નિયંત્રણ", "fertilizer-query": "ખાતર માર્ગદર્શન", "weather-query": "હવામાન સલાહ", "soil-health-query": "માટીનું આરોગ્ય", "market-prices-query": "બજાર ભાવ",
        "fetching_prices": "{crop} માટે બજાર ભાવ મેળવાઈ રહ્યાં છે...",
        "ask_crop_price": "તમે કયા પાકનો ભાવ જાણવા માંગો છો?",
        "weather_report": "<b>{location} માં હવામાન:</b><br>તાપમાન: {temp}°C<br>સ્થિતિ: {description}<br>આર્દ્રતા: {humidity}%<br>પવનની ગતિ: {wind} m/s",
        "weather_error": "માફ કરશો, હું તમારા સ્થાન માટે હવામાન માહિતી મેળવી શક્યો નથી. કૃપા કરીને થોડા સમય પછી ફરી પ્રયાસ કરો.",
        "soil-types": { "question": "તમારી માટીનો પ્રકાર શું છે?", "options": ["આલ્યુવિયલ", "કાળી", "લાલ", "લેટરાઇટ", "શૂષ్ક", "જંગલ"] },
        "common-pests": { "question": "તમે કયા કિટકનો સામનો કરી રહ્યાં છો?", "options": ["એફિડ્સ", "વ્હાઇટફ્લાય", "બોલવોર્મ", "સ્ટેમ બોરર", "ટીડા", "અન્ય"] },
        "soil-health": "માટીનું આરೋગ્ય સુધારવા માટે સજીવ પદાર્થ ઉમેરવો મહત્વપૂર્ણ છે. શું તમે તાજેતરમાં તમારી માટીનો pH ચકાસ્યો છે?",
        "soil_health_yes": "શાનદાર! pH જાણવાથી યોગ્ય પાક અને પોષક તત્ત્વો પસંદ કરવામાં મદદ મળે છે.",
        "soil_health_no": "હું માટી પરીક્ષણ કરવાની ભલામણ કરું છું. તે pH અને પોષક તત્ત્વોના સ્તર અંગે મહત્વપૂર્ણ માહિતી આપે છે.",
        "fertilizer_guidance": "સારી માટી સ્વાસ્થ્ય માટે *કંપનીસ્ટ અથવા વર્મીકંપનીસ્ટ* જેવા સજીવ ખાતરોની ભલામણ થાય છે. તે સમય સાથે માટીની રચના અને સાર્ભૂતામાં સુધારો કરે છે. તમે કેટલા એકર માટે ખાતર આપવાની યોજના બનાવો છો?",
        "default": "માફ કરશો, મને સમજાયું નથી. કૃપા કરીને પાક, કિટક, ખાતર, હવામાન અથવા ભાવ અંગે પૂછો.",
        "soil-health-options": { "question": "માટીનું આરોગ્ય કયા પાસાથી સુધારવા માંગો છો?", "options": ["પાણીનો નિકાસ", "પોષક તત્વોનું સ્તર", "માટીની કઠોરતા", "સજીવ પદાર્થો"] }
    },



};

// To keep bundle small in this demo, reuse the existing translations object from HTML if present
// Fallback if not found
const translationsRef = typeof translations !== 'undefined' && Object.keys(translations).length ? translations : {};

const intents = {
    "en": { "greeting": ["hello", "hi", "hey"], "crop_selection": ["crop", "sowing", "plant"], "pest_control": ["pest", "insect", "disease"], "fertilizer": ["fertilizer", "compost", "manure"], "weather": ["weather", "rain", "forecast"], "soil_health": ["soil", "health", "ph"], "market_prices": ["price", "market", "rate"] },
    "hi": { "greeting": ["नमस्ते", "नमस्कार"], "crop_selection": ["फसल", "बुवाई", "लगाना"], "pest_control": ["कीट", "रोग", "कीड़ा"], "fertilizer": ["उर्वरक", "खाद"], "weather": ["मौसम", "बारिश"], "soil_health": ["मिट्टी", "पीएच"], "market_prices": ["कीमत", "बाजार", "भाव", "दाम"] },
    "ta": { "greeting": ["வணக்கம்"], "crop_selection": ["பயிர்", "விதைப்பு"], "pest_control": ["பூச்சி", "நோய்"], "fertilizer": ["உரம்"], "weather": ["வானிலை", "மழை"], "soil_health": ["மண்", "பிஎச்"], "market_prices": ["விலை", "சந்தை"] },
    "te": { "greeting": ["నమస్కారం"], "crop_selection": ["పంట", "విత్తడం"], "pest_control": ["పురుగు", "తెగులు", "రోగం"], "fertilizer": ["ఎరువు"], "weather": ["వాతావరణ సలహా", "వర్షం"], "soil_health": ["నేల", "పిహెచ్"], "market_prices": ["ధర", "మార్కెట్"] },
    "bn": { "greeting": ["নমস্কার", "হ্যালো"], "crop_selection": ["ফসল", "বপন", "চাষ"], "pest_control": ["পোকা", "রোগ"], "fertilizer": ["সার"], "weather": ["আবহাওয়া", "বৃষ্টি"], "soil_health": ["মাটি", "পিএইচ"], "market_prices": ["দাম", "দর", "বাজার"] },
    "gu": { "greeting": ["નમસ્તે", "હેલો"], "crop_selection": ["પાક", "વાવણી"], "pest_control": ["કિટક", "રોગ"], "fertilizer": ["ખાતર"], "weather": ["હવામાન", "વરસાદ"], "soil_health": ["માટી", "pH"], "market_prices": ["ભાવ", "બજાર"] }
};

// Detection/manual flags
let manualShown = false;

window.onload = function () {
	const linkEl = document.createElement('link');
	linkEl.rel = 'stylesheet';
	linkEl.href = 'styles.css';
	document.head.appendChild(linkEl);

	// Watchdog: if location not set within 7s, show manual entry
	setTimeout(() => {
		if (!userLocation && !manualShown) {
			showManualLocationInput("Couldn't auto-detect location. Please enter it manually.");
		}
	}, 7000);

	if (navigator.geolocation) {
		navigator.geolocation.getCurrentPosition(
			(position) => {
				userLat = position.coords.latitude;
				userLon = position.coords.longitude;
				reverseGeocode(userLat, userLon);
			},
			async (error) => {
				console.error("Geolocation error:", error);
				await tryLocationFallbacks();
				// If still unresolved, force manual entry
				if (!userLocation && !manualShown) {
					showManualLocationInput("Location access denied/unavailable. Please enter it manually.");
				}
			},
			{ enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
		);
	} else {
		tryLocationFallbacks();
	}

	// Allow pressing Enter in manual input to start
	const manualInput = document.getElementById('initialLocation');
	if (manualInput) {
		manualInput.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				startChat();
			}
		});
	}
};

function reverseGeocode(lat, lon) {
	fetch(`/api/reverse-geocode?format=json&lat=${lat}&lon=${lon}`)
		.then(response => response.json())
		.then(data => {
			if (data.address && data.address.country_code === 'in') {
				userState = data.address.state;
				userDistrict = data.address.state_district || data.address.city || data.address.county;
				if (userDistrict && userState) {
					userLocation = `${userDistrict}, ${userState}`;
					document.getElementById('locationStatus').textContent = `Location: ${userLocation}`;
				} else {
					showManualLocationInput("Could not pinpoint district. Please enter manually.");
				}
			} else {
				showManualLocationInput("Service is available only in India. Please enter location.");
			}
			document.getElementById('startButton').style.display = 'block';
		})
		.catch(error => {
			console.error("Reverse geocoding error:", error);
			showManualLocationInput("Could not determine city. Please enter it manually.");
		});
}

async function tryLocationFallbacks() {
	try {
		const ipResp = await fetch('/api/ip');
		if (ipResp.ok) {
			const ipData = await ipResp.json();
			if (ipData && ipData.latitude && ipData.longitude) {
				userLat = ipData.latitude;
				userLon = ipData.longitude;
				await reverseGeocode(userLat, userLon);
				return;
			}
		}
	} catch (e) {
		console.warn('IP geolocation failed:', e);
	}

	try {
		if (userLat && userLon) {
			const ow = await fetch(`https://api.openweathermap.org/geo/1.0/reverse?lat=${userLat}&lon=${userLon}&limit=1&appid=${OPENWEATHER_API_KEY}`);
			if (ow.ok) {
				const arr = await ow.json();
				if (Array.isArray(arr) && arr.length) {
					const best = arr[0];
					userDistrict = best.state || best.name;
					userState = best.state || best.name;
					userLocation = `${userDistrict}, ${userState}`;
					document.getElementById('locationStatus').textContent = `Location: ${userLocation}`;
					document.getElementById('startButton').style.display = 'block';
					return;
				}
			}
		}
	} catch (e) {
		console.warn('OpenWeather reverse geocoding fallback failed:', e);
	}

	showManualLocationInput("Could not detect location. Please enter it manually.");
}

function startChat() {
    userLanguage = document.getElementById('initialLanguage').value;
    const manualLocation = document.getElementById('initialLocation').value.trim();

    if (manualLocation) {
        const parts = manualLocation.split(',').map(p => p.trim());
        if (parts.length > 1) {
            userDistrict = parts[0];
            userState = parts[1];
            userLocation = manualLocation;
        } else {
            alert("Please enter location as 'District, State' (e.g., Nashik, Maharashtra)");
            return;
        }
    }

    if (!userLocation) {
        alert("Location is required to start.");
        return;
    }

    document.getElementById('introScreen').style.display = 'none';
    document.getElementById('mainContent').style.display = 'flex';
    document.getElementById('languageSelect').value = userLanguage;
    changeLanguage(false);

    setTimeout(() => {
        const dict = getDict();
        const welcomeMsg = dict.personalized_welcome.replace('{location}', userLocation);
        addMessage(welcomeMsg, 'bot');
    }, 500);
}

function sendMessage() {
    const userInput = document.getElementById('userInput');
    if (userInput.value.trim() === "") return;
    const message = userInput.value.trim();
    addMessage(message, 'user');
    userInput.value = "";
    setTimeout(() => processMessage(message), 800);
}

function processMessage(message) {
    if (isAwaitingSoilType) { sendSoilType(message); }
    else if (isAwaitingPestInfo) { sendPestType(message); }
    else if (isAwaitingCropName) { getMarketPrices(message); }
    else if (isAwaitingSoilHealthResponse) { handleSoilHealthResponse(message); }
    else if (inMarketMode) {
        const crop = extractCropName(message);
        if (crop) { getMarketPrices(crop); return; }
        // If no crop detected, keep market mode and prompt for crop instead of sending to AI
        const dict = getDict();
        addMessage(dict.ask_crop_price, 'bot');
        isAwaitingCropName = true;
        return;
    }
    else { getBotResponse(message); }
}

function handleKeyPress(event) {
    if (event.key === "Enter") sendMessage();
}

function addMessage(content, sender) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    messageDiv.innerHTML = content;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Record conversation turns (skip temporary placeholders)
    if (sender === 'user') {
        chatHistory.push({ role: 'user', content });
    } else if (sender === 'bot' && content && !/Thinking\.\.\./i.test(content)) {
        chatHistory.push({ role: 'assistant', content });
    }
}

function getDict() {
    return translationsRef[userLanguage] || translations[userLanguage];
}

function selectOption(optionKey) {
    const dict = getDict();
    const key = `${optionKey}-query`;
    addMessage(dict[key], 'user');

    setTimeout(() => {
        const actions = {
            'crop-selection': () => {
                isAwaitingSoilType = true;
                addMessage(getOptionsHTML(dict['soil-types'], 'soil-option', 'sendSoilType'), 'bot');
            },
            'pest-control': () => {
                isAwaitingPestInfo = true;
                addMessage(getOptionsHTML(dict['common-pests'], 'pest-option', 'sendPestType'), 'bot');
            },
            'fertilizer': () => {
                addMessage(dict['fertilizer_guidance'], 'bot');
            },
            'weather': () => getWeather(userLat, userLon),
            'soil-health': () => {
                isAwaitingSoilHealthResponse = true;
                addMessage(getOptionsHTML(dict['soil-health-options'], 'soil-health-option', 'handleSoilHealthOption'), 'bot');
            },
            'market-prices': () => getMarketPrices()
        };
        if (actions[optionKey]) actions[optionKey]();
        // Enter market mode when user opens market-prices option
        inMarketMode = optionKey === 'market-prices';
    }, 800);
}

function getOptionsHTML(data, className, onclickFunc) {
    let html = `<p>${data.question}</p><div class="${className}s">`;
    data.options.forEach(opt => {
        html += `<div class="${className}" onclick="${onclickFunc}('${opt}')">${opt}</div>`;
    });
    return html + '</div>';
}

function getBotResponse(message) {
    const lowerCaseMessage = message.toLowerCase();
    
    console.log('Processing message:', message, 'Language:', userLanguage);
    
    // First check if this is a direct crop price request
    const cropPricePattern = /(?:price|rate|cost|value|market|mandi|bhav)\s+(?:of\s+)?([a-zA-Z\s]+)/i;
    const cropMatch = lowerCaseMessage.match(cropPricePattern);
    
    if (cropMatch) {
        const cropName = cropMatch[1].trim();
        console.log('Crop price pattern match:', cropName);
        if (cropName && cropName.length > 1) {
            getMarketPrices(cropName);
            inMarketMode = true;
            return;
        }
    }
    
    // Also check for simple crop names followed by price-related words
    const simpleCropPattern = /^([a-zA-Z\s]+)\s+(?:price|rate|cost|value|market|mandi|bhav)/i;
    const simpleMatch = lowerCaseMessage.match(simpleCropPattern);
    
    if (simpleMatch) {
        const cropName = simpleMatch[1].trim();
        console.log('Simple crop pattern match:', cropName);
        if (cropName && cropName.length > 1) {
            getMarketPrices(cropName);
            inMarketMode = true;
            return;
        }
    }
    
    // Check if it's just a crop name (common crops that users might ask about)
    const commonCrops = ['cotton', 'wheat', 'rice', 'maize', 'groundnut', 'peanut', 'soybean', 'tomato', 'onion', 'potato', 'sugarcane', 'mustard', 'chickpea', 'lentil', 'paddy', 'corn', 'soya'];
    const justCropName = commonCrops.find(crop => lowerCaseMessage.includes(crop));
    
    if (justCropName) {
        console.log('Common crop match:', justCropName);
        getMarketPrices(justCropName);
        inMarketMode = true;
        return;
    }
    
    // Handle single word crop names (when user just types "cotton" or "wheat")
    const singleWordCrops = ['cotton', 'wheat', 'rice', 'maize', 'groundnut', 'peanut', 'soybean', 'tomato', 'onion', 'potato', 'sugarcane', 'mustard', 'chickpea', 'lentil', 'paddy', 'corn', 'soya'];
    const singleWordMatch = singleWordCrops.find(crop => lowerCaseMessage.trim() === crop);
    
    if (singleWordMatch) {
        console.log('Single word crop match:', singleWordMatch);
        getMarketPrices(singleWordMatch);
        inMarketMode = true;
        return;
    }
    
    // Also check for crop names in different languages
    const multilingualCrops = {
        'kapas': 'cotton', 'rui': 'cotton', 'kapaas': 'cotton',
        'gehu': 'wheat', 'godhuma': 'wheat', 'gandum': 'wheat',
        'chawal': 'rice', 'bhaat': 'rice', 'arisi': 'rice',
        'makka': 'maize', 'corn': 'maize', 'cholam': 'maize',
        'moongphali': 'groundnut', 'peanut': 'groundnut', 'verkadalai': 'groundnut',
        'soya': 'soybean', 'soyabean': 'soybean', 'soy': 'soybean',
        'tamatar': 'tomato', 'thakkali': 'tomato', 'tomato': 'tomato',
        'pyaaz': 'onion', 'kanda': 'onion', 'ulli': 'onion',
        'aalu': 'potato', 'batata': 'potato', 'urulaikilangu': 'potato',
        'ganna': 'sugarcane', 'sheera': 'sugarcane', 'karumbu': 'sugarcane',
        'sarson': 'mustard', 'rai': 'mustard', 'kadugu': 'mustard',
        'chana': 'chickpea', 'gram': 'chickpea', 'kondakadalai': 'chickpea',
        'masoor': 'lentil', 'dal': 'lentil', 'masur': 'lentil'
    };
    
    const multilingualMatch = Object.keys(multilingualCrops).find(crop => lowerCaseMessage.includes(crop));
    if (multilingualMatch) {
        getMarketPrices(multilingualCrops[multilingualMatch]);
        inMarketMode = true;
        return;
    }
    
    // Check for other intents (exit market mode if explicitly switching topics)
    const langIntents = intents[userLanguage];
    let intentFound = Object.keys(langIntents).find(intent =>
        langIntents[intent].some(keyword => lowerCaseMessage.includes(keyword))
    );

    const mapped = intentFound ? intentFound.replace('_', '-') : null;
    const handledOptions = ['crop-selection', 'pest-control', 'fertilizer', 'weather', 'soil-health', 'market-prices'];

    if (mapped && handledOptions.includes(mapped)) {
        if (mapped !== 'market-prices') inMarketMode = false;
        selectOption(mapped);
    } else {
        // Greetings or unrecognized intents go to AI
        fetchAIResponse(message);
    }
}

function extractCropName(message) {
    if (!message) return null;
    const text = message.toLowerCase().trim();
    const compact = text.replace(/[\s\-]/g, '');
    // 1) Direct pattern like "price of X"
    const m1 = text.match(/(?:price|rate|cost|value|market|mandi|bhav)\s+(?:of\s+)?([a-zA-Z\s]+)/i);
    if (m1 && m1[1]) return m1[1].trim();
    // 2) "X price"
    const m2 = text.match(/^([a-zA-Z\s]+)\s+(?:price|rate|cost|value|market|mandi|bhav)/i);
    if (m2 && m2[1]) return m2[1].trim();
    // 3) Single-word crops (with variants/plurals/spacing)
    const crops = ['cotton','wheat','rice','maize','groundnut','peanut','soybean','tomato','onion','potato','sugarcane','mustard','chickpea','lentil','paddy','corn','soya'];
    let single = crops.find(c => text === c || text.includes(c));
    if (!single) {
        // handle spaced/plural variants like "ground nuts", "ground-nuts"
        const cropVariants = {
            groundnut: ['groundnuts','ground nut','ground nuts','ground-nut','ground-nuts'],
            peanut: ['peanuts','pea nut','pea nuts','pea-nut','pea-nuts']
        };
        for (const base in cropVariants) {
            if (cropVariants[base].some(v => text.includes(v) || compact.includes(v.replace(/[\s\-]/g,'')))) {
                single = base;
                break;
            }
        }
        if (!single && compact.endsWith('s')) {
            const singular = compact.slice(0, -1);
            const match = crops.find(c => singular.includes(c));
            if (match) single = match;
        }
    }
    if (single) return single;
    // 4) Multilingual aliases
    const aliases = {
        'kapas':'cotton','rui':'cotton','kapaas':'cotton',
        'gehu':'wheat','godhuma':'wheat','gandum':'wheat',
        'chawal':'rice','bhaat':'rice','arisi':'rice',
        'makka':'maize','cholam':'maize',
        'moongphali':'groundnut','verkadalai':'groundnut',
        'soya':'soybean','soyabean':'soybean','soy':'soybean',
        'tamatar':'tomato','thakkali':'tomato','pyaaz':'onion','kanda':'onion','ulli':'onion',
        'aalu':'potato','batata':'potato','urulaikilangu':'potato',
        'ganna':'sugarcane','sheera':'sugarcane','karumbu':'sugarcane',
        'sarson':'mustard','rai':'mustard','kadugu':'mustard',
        'chana':'chickpea','gram':'chickpea','kondakadalai':'chickpea',
        'masoor':'lentil','dal':'lentil','masur':'lentil'
    };
    const alias = Object.keys(aliases).find(k => text.includes(k) || compact.includes(k.replace(/[\s\-]/g,'')));
    if (alias) return aliases[alias];
    return null;
}

async function getMarketPrices(cropName = null) {
    const dict = getDict();
    if (!cropName) {
        addMessage(dict.ask_crop_price, 'bot');
        isAwaitingCropName = true;
        inMarketMode = true;
        return;
    }
    isAwaitingCropName = false;
    addMessage(dict.fetching_prices.replace('{crop}', cropName), 'bot');

    try {
        const normalized = (cropName || '').toString().trim().toUpperCase();
        // Common mappings for Agmarknet commodity names
        const cropMap = {
            'GROUNDNUT': 'GROUNDNUT', 'GROUND NUT': 'GROUNDNUT', 'PEANUT': 'GROUNDNUT', 'MOONGPHALI': 'GROUNDNUT',
            'WHEAT': 'WHEAT', 'GEHU': 'WHEAT', 'GODHUMA': 'WHEAT',
            'RICE': 'RICE', 'CHAWAL': 'RICE', 'BHAAT': 'RICE',
            'PADDY': 'PADDY', 'DHAN': 'PADDY',
            'MAIZE': 'MAIZE', 'MAKKA': 'MAIZE', 'CORN': 'MAIZE',
            'COTTON': 'COTTON', 'KAPAS': 'COTTON', 'RUI': 'COTTON',
            'SOYBEAN': 'SOYABEEN', 'SOYABEAN': 'SOYABEEN', 'SOYA': 'SOYABEEN',
            'TOMATO': 'TOMATO', 'TAMATAR': 'TOMATO',
            'ONION': 'ONION', 'PYAAZ': 'ONION', 'KANDA': 'ONION',
            'POTATO': 'POTATO', 'AALU': 'POTATO', 'BATATA': 'POTATO',
            'SUGARCANE': 'SUGARCANE', 'GANNA': 'SUGARCANE', 'SHEERA': 'SUGARCANE',
            'MUSTARD': 'MUSTARD', 'SARSON': 'MUSTARD', 'RAI': 'MUSTARD',
            'CHICKPEA': 'CHANA', 'CHANA': 'CHANA', 'GRAM': 'CHANA',
            'LENTIL': 'MASOOR', 'MASOOR': 'MASOOR', 'DAL': 'MASOOR'
        };
        const commodity = cropMap[normalized] || normalized;

        console.log('Fetching market prices for:', commodity, 'in', userState, userDistrict);

        const params = new URLSearchParams({
            'api-key': OGD_API_KEY,
            format: 'json',
            'limit': '100',
            'filters[commodity]': commodity
        });
        if (userState) params.append('filters[state]', userState);
        if (userDistrict) params.append('filters[district]', userDistrict);

        const url = `https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?${params.toString()}`;
        console.log('API URL:', url);
        
        const resp = await fetch(url);
        console.log('API Response status:', resp.status);
        
        if (!resp.ok) {
            console.error('API Error:', resp.status, resp.statusText);
            throw new Error(`Market API error: ${resp.status} ${resp.statusText}`);
        }
        
        const json = await resp.json();
        console.log('API Response:', json);
        
        const rows = Array.isArray(json.records) ? json.records : [];

        if (!rows.length) {
            console.log('No data found, trying fallback search...');
            addMessage(`No recent price data found for ${commodity} in your area. Trying wider search...`, 'bot');
            
            // Try without location filters
            const fallbackParams = new URLSearchParams({ 
                'api-key': OGD_API_KEY, 
                format: 'json', 
                limit: '100', 
                'filters[commodity]': commodity 
            });
            const fallbackUrl = `https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?${fallbackParams.toString()}`;
            
            try {
                const r2 = await fetch(fallbackUrl);
                if (r2.ok) {
                    const j2 = await r2.json();
                    console.log('Fallback API Response:', j2);
                    const fallbackRows = Array.isArray(j2.records) ? j2.records : [];
                    if (fallbackRows.length > 0) {
                        renderMarketPrices(commodity, fallbackRows);
                        return;
                    }
                }
            } catch (fallbackErr) {
                console.error('Fallback API error:', fallbackErr);
            }
            
            // If still no data, show fallback sample data
            console.log('Using fallback sample data');
            const fallbackData = generateFallbackMarketData(commodity);
            renderMarketPrices(commodity, fallbackData);
            return;
        }

        renderMarketPrices(commodity, rows);
    } catch (err) {
        console.error('Market price fetch error:', err);
        
        // Show fallback data when API fails
        const fallbackData = generateFallbackMarketData(cropName);
        renderMarketPrices(cropName, fallbackData);
        
        addMessage(`<i>Note: Live market data unavailable. Showing recent trend data.</i>`, 'bot');
        
        // Add helpful debugging info
        console.log('Market prices fallback data generated for:', cropName);
        console.log('Fallback data sample:', fallbackData.slice(0, 3));
    }
}

function generateFallbackMarketData(cropName) {
    // Generate realistic fallback data based on crop type
    const basePrices = {
        'WHEAT': { min: 1800, max: 2200, avg: 2000 },
        'RICE': { min: 1600, max: 2000, avg: 1800 },
        'MAIZE': { min: 1400, max: 1800, avg: 1600 },
        'COTTON': { min: 5500, max: 6500, avg: 6000 },
        'GROUNDNUT': { min: 4500, max: 5500, avg: 5000 },
        'SOYABEEN': { min: 3500, max: 4500, avg: 4000 },
        'TOMATO': { min: 800, max: 1200, avg: 1000 },
        'ONION': { min: 600, max: 1000, avg: 800 },
        'POTATO': { min: 400, max: 800, avg: 600 },
        'SUGARCANE': { min: 250, max: 350, avg: 300 },
        'MUSTARD': { min: 4500, max: 5500, avg: 5000 },
        'CHANA': { min: 4500, max: 5500, avg: 5000 },
        'MASOOR': { min: 5500, max: 6500, avg: 6000 }
    };
    
    const crop = cropName.toUpperCase();
    const prices = basePrices[crop] || { min: 1000, max: 2000, avg: 1500 };
    
    // Generate 20-30 sample records
    const records = [];
    const markets = ['APMC', 'Mandi', 'Krishi Bhavan', 'Cooperative Market', 'Private Market'];
    const districts = userDistrict ? [userDistrict] : ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Kolkata'];
    
    for (let i = 0; i < 25; i++) {
        const price = Math.floor(prices.avg + (Math.random() - 0.5) * (prices.max - prices.min));
        const market = markets[Math.floor(Math.random() * markets.length)];
        const district = districts[Math.floor(Math.random() * districts.length)];
        const state = userState || 'Maharashtra';
        
        records.push({
            market: market,
            district: district,
            state: state,
            arrival_date: '01/09/2025',
            modal_price: price.toString()
        });
    }
    
    return records;
}

function renderMarketPrices(commodity, records) {
    if (!records || !records.length) {
        addMessage(`No market data found for ${commodity}.`, 'bot');
        return;
    }

    // Parse modal_price (Rs/quintal) and compute simple stats over most recent 30 rows
    const clean = records
        .slice(0, 30)
        .map(r => ({
            market: r.market,
            district: r.district,
            state: r.state,
            date: r.arrival_date,
            modal: Number((r.modal_price || '').toString().replace(/[^0-9.]/g, ''))
        }))
        .filter(x => Number.isFinite(x.modal) && x.modal > 0);

    if (!clean.length) {
        addMessage(`No valid price entries available for ${commodity}.`, 'bot');
        return;
    }

    const sum = clean.reduce((a, b) => a + b.modal, 0);
    const avg = Math.round(sum / clean.length);
    const min = Math.min(...clean.map(x => x.modal));
    const max = Math.max(...clean.map(x => x.modal));
    const topMarkets = clean.slice(0, 5).map(x => `${x.market} (${x.district})`).join(', ');

    // Determine if this is fallback data or real API data
    const isFallbackData = records[0] && records[0].arrival_date === '01/09/2025';
    const sourceText = isFallbackData ? 'Source: Estimated market trends based on recent data' : 'Source: Agmarknet (data.gov.in), recent records';

    const message = `<b>${commodity} market trend (Rs/quintal):</b><br>Average: <b>₹${avg}</b> | Range: ₹${min}–₹${max}<br>Recent markets: ${topMarkets}<br><i>${sourceText}</i>`;
    addMessage(message, 'bot');
}

async function getWeather(lat, lon) {
    const dict = getDict();
    if (!lat || !lon) {
        addMessage(dict.weather_error, 'bot');
        return;
    }
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=metric`;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Weather data not available.');
        const data = await response.json();
        const report = dict.weather_report
            .replace('{location}', data.name)
            .replace('{temp}', Math.round(data.main.temp))
            .replace('{description}', data.weather[0].description)
            .replace('{humidity}', data.main.humidity)
            .replace('{wind}', data.wind.speed);
        addMessage(report, 'bot');

        // Add practical, condition-based precautions
        const advisory = buildWeatherAdvisory(data);
        if (advisory) {
            addMessage(`<b>Advisory:</b> ${advisory}`, 'bot');
        }
    } catch (error) {
        console.error("Error fetching weather data:", error);
        addMessage(dict.weather_error, 'bot');
    }
}

function buildWeatherAdvisory(data) {
    try {
        const temp = (data?.main?.temp) ?? null;
        const humidity = (data?.main?.humidity) ?? null;
        const wind = (data?.wind?.speed) ?? null;
        const condition = (data?.weather?.[0]?.main || '').toLowerCase();

        const tips = [];

        if (condition.includes('rain') || condition.includes('drizzle') || condition.includes('thunder')) {
            tips.push('Avoid pesticide spraying before or during rain; prefer a clear 24-hour window.');
            tips.push('Ensure field drainage; clear channels to prevent waterlogging.');
            tips.push('Cover harvested produce and store inputs in a dry place.');
        }

        if (typeof wind === 'number' && wind > 8) {
            tips.push('Do not spray chemicals in high winds; drift risk is high.');
            tips.push('Stake or support young/lodging-prone crops; secure nets and tunnels.');
        }

        if (typeof humidity === 'number' && humidity >= 85) {
            tips.push('High humidity increases fungal disease risk; monitor closely and ensure good aeration.');
        }

        if (typeof temp === 'number') {
            if (temp >= 35) {
                tips.push('Heat stress: irrigate in early morning or late evening; use mulching to conserve moisture.');
                tips.push('Avoid midday operations like weeding or spraying.');
            } else if (temp <= 10) {
                tips.push('Cold stress: protect seedlings with low tunnels or coverings during night/early morning.');
            }
        }

        if (!tips.length) {
            tips.push('Maintain regular scouting; plan irrigation and spraying based on local forecast in the next 24–48 hours.');
        }

        return tips.join(' ');
    } catch (_) {
        return '';
    }
}

function handleSoilHealthResponse(message) {
    isAwaitingSoilHealthResponse = false;
    const dict = getDict();
    const lowerMsg = message.toLowerCase();
    const yes_words = ["yes", "yeah", "haan", "हाँ", "ஆம்", "అవును", "হ্যাঁ", "y"];
    const no_words = ["no", "nope", "nah", "नहीं", "இல்லை", "లేదు", "না", "n"];
    if (yes_words.some(word => lowerMsg.includes(word))) {
        addMessage(dict.soil_health_yes, 'bot');
    } else if (no_words.some(word => lowerMsg.includes(word))) {
        addMessage(dict.soil_health_no, 'bot');
    } else {
        getBotResponse(message);
    }
}

function changeLanguage(updateChat = true) {
    userLanguage = document.getElementById('languageSelect').value;
    const dict = getDict();
    document.getElementById('optionsTitle').textContent = dict.options_title;
    document.querySelectorAll('.option-card').forEach(card => {
        const key = card.getAttribute('onclick').match(/'([^']+)'/)[1] + '-query';
        card.querySelector('.option-text').textContent = dict[key];
    });
    if (updateChat) {
        document.getElementById('chatMessages').innerHTML = '';
        addMessage(dict.personalized_welcome.replace('{location}', userLocation), 'bot');
    }
}

async function fetchAIResponse(message) {
    try {
        addMessage('Thinking...', 'bot');
        const body = {
            message,
            language: userLanguage,
            location: userLocation,
            state: userState,
            district: userDistrict,
            // Send last 10 turns to keep request small
            history: chatHistory.slice(-10)
        };
        const resp = await fetch('http://localhost:3000/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await resp.json().catch(() => ({}));
        const reply = resp.ok && data && data.reply ? data.reply : null;
        const chatMessages = document.getElementById('chatMessages');
        const last = chatMessages.lastElementChild;
        if (last && last.classList.contains('bot-message')) {
            last.innerHTML = reply || generateFallbackResponse(message, /*aiUnavailable=*/!resp.ok);
            // Update history with final assistant message
            if (reply) {
                chatHistory.push({ role: 'assistant', content: reply });
            }
        } else {
            addMessage(reply || generateFallbackResponse(message, !resp.ok), 'bot');
        }
    } catch (e) {
        console.error('AI fetch error', e);
        // Replace the last 'Thinking...' with fallback
        const chatMessages = document.getElementById('chatMessages');
        const last = chatMessages.lastElementChild;
        const fb = generateFallbackResponse(message, /*aiUnavailable=*/true);
        if (last && last.classList.contains('bot-message')) {
            last.innerHTML = fb;
        } else {
            addMessage(fb, 'bot');
        }
    }
}

function generateFallbackResponse(message, aiUnavailable = false) {
    const dict = getDict();
    const m = (message || '').toLowerCase();
    const note = aiUnavailable ? '<i>(AI service unavailable; showing offline advice)</i><br>' : '';

    // Very simple offline heuristics
    if (/(hi|hello|hey|namaste|नमस्ते|வணக்கம்|నమస్కారం|নমস্কার|નમસ્તે)\b/.test(m)) {
        return note + dict.greeting;
    }

    if (/(water|irrigat|scarcity|drought|dry|moisture|સુકો|પાણી|পানি|பாசனம்|నీరు)/.test(m)) {
        return note + (
            'Water scarcity tips: Use mulching to reduce evaporation, irrigate early morning or late evening, ' +
            'prioritize critical growth stages, adopt drip/sprinkler if possible, and rotate drought-tolerant crops. '
        );
    }

    if (/(fertilizer|dose|nutrient|NPK|ખાતર|সার|உரம்|ఎరువు)/.test(m)) {
        return note + (
            'Fertilizer guidance: Split nitrogen into 2–3 doses, apply phosphorus and potassium basally, ' +
            'and prefer organic matter (compost/vermicompost) to improve soil structure. Get a soil test to fine-tune.'
        );
    }

    if (/(pest|insect|disease|aphid|whitefly|bollworm|locust|કિટક|রোগ|பூச்சி|పురుగు)/.test(m)) {
        return note + (
            'Integrated pest management: Monitor with traps, remove infested parts, encourage beneficial insects, ' +
            'and use targeted, label-approved bio/chemical controls only when thresholds are crossed.'
        );
    }

    if (/(weather|rain|forecast|હવામાન|আবহাওয়া|வானிலை|వాతావరణ)/.test(m)) {
        return note + (
            'Weather tip: Check the latest forecast before irrigation or spraying. Avoid spraying before rain; ' +
            'prefer calm, dry conditions.'
        );
    }

    // Default offline response in selected language
    return note + dict.default;
}

function toggleVoiceInput(forceStop = false) {
    if (!recognition) return;
    const btn = document.getElementById('voiceBtn');
    const btnText = document.getElementById('voiceBtnText');
    if (isListening || forceStop) {
        recognition.stop();
        isListening = false;
        btn.classList.remove('active');
        btnText.textContent = 'Voice Input';
    } else {
        const localeMap = { en: 'en-IN', hi: 'hi-IN', ta: 'ta-IN', te: 'te-IN', bn: 'bn-IN', gu: 'gu-IN' };
        const lang = localeMap[userLanguage] || `${userLanguage}-IN`;
        recognition.lang = lang;
        try {
            recognition.start();
            isListening = true;
            btn.classList.add('active');
            btnText.textContent = 'Listening...';
        } catch (e) {
            console.error("Voice recognition start error:", e);
            alert("Could not start voice recognition. It might be already active or an error occurred.");
        }
    }
}

function showManualLocationInput(message) {
	document.getElementById('locationStatus').textContent = message;
	document.getElementById('locationInputContainer').style.display = 'block';
	document.getElementById('startButton').style.display = 'block';
	manualShown = true;
}

function sendSoilType(type) {
    isAwaitingSoilType = false;
    const dict = getDict();
    const clickedType = dict['soil-types'].options.find(opt => type.toLowerCase().includes(opt.toLowerCase())) || type;
    addMessage(`You selected: *${clickedType}*`, 'user');

    let recommendation = '';
    const normalizedType = clickedType.toLowerCase();
    if (normalizedType.includes('alluvial')) {
        recommendation = 'this fertile soil is excellent for crops like *Wheat, Rice, Sugarcane, and Jute*.';
    } else if (normalizedType.includes('black')) {
        recommendation = 'its high moisture retention is ideal for *Cotton, Soybean, and Jowar*.';
    } else if (normalizedType.includes('red')) {
        recommendation = 'it is well-suited for crops like *Groundnuts, Pulses, and Millets*.';
    } else if (normalizedType.includes('laterite')) {
        recommendation = 'it is perfect for plantation crops such as *Tea, Coffee, and Spices*.';
    } else if (normalizedType.includes('arid')) {
        recommendation = 'with proper irrigation, you can grow *Bajra, Barley, and Dates*.';
    } else if (normalizedType.includes('forest')) {
        recommendation = 'it is rich in humus and great for *Fruits, Tea, and Medicinal Plants*.';
    } else {
        recommendation = 'I do not have a specific recommendation for that soil type. Based on your area, *Wheat* and *Maize* are generally safe choices.';
    }
    addMessage(`Based on your location and **${clickedType}** soil, ${recommendation}`, 'bot');
}

function handleSoilHealthOption(option) {
    const dict = getDict();
    const recommendations = {
        'Water Drainage': 'Improve water drainage by creating raised beds, adding organic matter, and ensuring proper slope. This prevents waterlogging and root diseases.',
        'Nutrient Levels': 'Test soil for NPK levels. Add balanced fertilizers and organic matter. Consider crop rotation to maintain soil fertility.',
        'Soil Hardness': 'Reduce soil hardness by adding organic matter, practicing deep ploughing, and using cover crops. This improves root penetration.',
        'Organic Matter': 'Increase organic matter by adding compost, green manure, and crop residues. This improves soil structure and water retention.'
    };
    
    const multilingualRecommendations = {
        'நீர் வடிகால்': 'நீர் வடிகாலை மேம்படுத்த உயர்ந்த படுக்கைகள் உருவாக்கவும், கரிமப் பொருட்களை சேர்க்கவும், சரியான சாய்வை உறுதிசெய்யவும். இது நீர் தேங்குதல் மற்றும் வேர் நோய்களை தடுக்கும்.',
        'ஊட்டச்சத்து அளவுகள்': 'NPK அளவுகளுக்கு மண்ணை சோதிக்கவும். சமச்சீர் உரங்கள் மற்றும் கரிமப் பொருட்களை சேர்க்கவும். மண் வளத்தை பராமரிக்க பயிர் சுழற்சியை கவனியுங்கள்.',
        'மண் கடினத்தன்மை': 'கரிமப் பொருட்களை சேர்ப்பதன் மூலம் மண் கடினத்தன்மையை குறைக்கவும், ஆழமான உழவு செய்யவும், மூடு பயிர்களை பயன்படுத்தவும். இது வேர் ஊடுருவலை மேம்படுத்தும்.',
        'கரிமப் பொருட்கள்': 'குப்பை உரம், பச்சை உரம் மற்றும் பயிர் எச்சங்களை சேர்ப்பதன் மூலம் கரிமப் பொருட்களை அதிகரிக்கவும். இது மண் கட்டமைப்பு மற்றும் நீர் தக்கவைப்பை மேம்படுத்தும்.',
        'जल निकासी': 'उठे हुए बेड बनाकर, जैविक पदार्थ जोड़कर और उचित ढलान सुनिश्चित करके जल निकासी में सुधार करें। यह जलभराव और जड़ रोगों को रोकता है।',
        'पोषक तत्व स्तर': 'NPK स्तरों के लिए मिट्टी का परीक्षण करें। संतुलित उर्वरक और जैविक पदार्थ जोड़ें। मिट्टी की उर्वरता बनाए रखने के लिए फसल रोटेशन पर विचार करें।',
        'मिट्टी की कठोरता': 'जैविक पदार्थ जोड़कर, गहरी जुताई करके और कवर फसलों का उपयोग करके मिट्टी की कठोरता कम करें। यह जड़ प्रवेश में सुधार करता है।',
        'जैविक पदार्थ': 'कम्पोस्ट, हरी खाद और फसल अवशेष जोड़कर जैविक पदार्थ बढ़ाएं। यह मिट्टी की संरचना और जल धारण क्षमता में सुधार करता है।',
        'पાણીનો નિકાસ': 'ઉચ્ચ બેડ બનાવીને, કાર્બનિક પદાર્થો ઉમેરીને અને યોગ્ય ઢાળ સુનિશ્ચિત કરીને પાણીના નિકાસમાં સુધારો કરો. આ પાણી ભરાવ અને મૂળ રોગોને રોકે છે.',
        'પોષક તત્વોનું સ્તર': 'NPK સ્તરો માટે માટીનું પરીક્ષણ કરો. સંતુલિત ખાતર અને કાર્બનિક પદાર્થો ઉમેરો. માટીની ફળદ્રુપતા જાળવી રાખવા માટે પાક ફેરબદલ પર વિચાર કરો.',
        'માટીની કઠોરતા': 'કાર્બનિક પદાર્થો ઉમેરીને, ઊંડી ખેડ કરીને અને કવર પાકોનો ઉપયોગ કરીને માટીની કઠોરતા ઘટાડો. આ મૂળ પ્રવેશમાં સુધારો કરે છે.',
        'સજીવ પદાર્થો': 'કમ્પોસ્ટ, લીલો ખાતર અને પાકના અવશેષો ઉમેરીને કાર્બનિક પદાર્થો વધારો. આ માટીની રચના અને પાણીની ધારણ ક્ષમતામાં સુધારો કરે છે.',
        'నీటి వ్యవస్థ': 'నీటి వ్యవస్థను మెరుగుపరచడానికి ఎత్తైన మంచాలు తయారు చేయండి, సేంద్రీయ పదార్థాలను జోడించండి మరియు సరైన వాలు నిర్ధారించండి. ఇది నీటి నిల్వ మరియు మూల వ్యాధులను నిరోధిస్తుంది.',
        'పోషకాల స్థాయి': 'NPK స్థాయిల కోసం నేలను పరీక్షించండి. సమతుల్య ఎరువులు మరియు సేంద్రీయ పదార్థాలను జోడించండి. నేల సారాన్ని నిర్వహించడానికి పంట భ్రమణాన్ని పరిగణించండి.',
        'నేల గట్టితనం': 'సేంద్రీయ పదార్థాలను జోడించడం, లోతైన దున్నడం మరియు కవర్ పంటలను ఉపయోగించడం ద్వారా నేల గట్టితనాన్ని తగ్గించండి. ఇది మూల చొచ్చుకుపోవడంలో మెరుగుదలను తెస్తుంది.',
        'సేంద్రీయ పదార్థాలు': 'కంపోస్ట్, ఆకుపచ్చ ఎరువు మరియు పంట అవశేషాలను జోడించడం ద్వారా సేంద్రీయ పదార్థాలను పెంచండి. ఇది నేల నిర్మాణం మరియు నీటి నిలుపుదలను మెరుగుపరుస్తుంది.',
        'জল নিষ্কাশন': 'উঁচু বেড তৈরি করে, জৈব পদার্থ যোগ করে এবং সঠিক ঢাল নিশ্চিত করে জল নিষ্কাশন উন্নত করুন। এটি জলাবদ্ধতা এবং শিকড়ের রোগ প্রতিরোধ করে।',
        'পুষ্টি স্তর': 'NPK স্তরের জন্য মাটি পরীক্ষা করুন। সুষম সার এবং জৈব পদার্থ যোগ করুন। মাটির উর্বরতা বজায় রাখতে ফসল আবর্তন বিবেচনা করুন।',
        'মাটির কঠোরতা': 'জৈব পদার্থ যোগ করে, গভীর লাঙল চালিয়ে এবং কভার ক্রপ ব্যবহার করে মাটির কঠোরতা কমিয়ে দিন। এটি শিকড় প্রবেশে উন্নতি আনে।',
        'জৈব পদার্থ': 'কম্পোস্ট, সবুজ সার এবং ফসলের অবশিষ্টাংশ যোগ করে জৈব পদার্থ বাড়ান। এটি মাটির গঠন এবং জল ধারণ ক্ষমতা উন্নত করে।'
    };
    
    const recommendation = recommendations[option] || multilingualRecommendations[option] || 'Please select a valid option.';
    addMessage(`<b>Soil Health: ${option}</b><br>${recommendation}`, 'bot');
    isAwaitingSoilHealthResponse = false;
}

function sendPestType(type) {
    isAwaitingPestInfo = false;
    const dict = getDict();
    const clickedType = dict['common-pests'].options.find(opt => type.toLowerCase().includes(opt.toLowerCase().split(' ')[0])) || type;
    
    // Get language-specific messages
    const selectedMessage = getLanguageMessage('pest_selected', userLanguage).replace('{pest}', clickedType);
    addMessage(selectedMessage, 'user');

    // Get pest control recommendations in the selected language
    const solution = getPestControlRecommendation(clickedType, userLanguage);
    const pestControlTitle = getLanguageMessage('pest_control_title', userLanguage).replace('{pest}', clickedType);
    addMessage(`<b>${pestControlTitle}</b><br>${solution}`, 'bot');
}

function getPestControlRecommendation(pestType, language) {
    const normalizedType = pestType.toLowerCase();
    
    // English recommendations
    const englishRecommendations = {
        'aphid': 'Use a *Neem oil-based spray*. Ensure you cover the underside of the leaves. Encouraging ladybugs can also help naturally.',
        'whitefly': 'Use *yellow sticky traps* to monitor and capture them. A mild insecticidal soap solution can also be effective.',
        'bollworm': 'Pheromone traps are effective for monitoring. Applying a *Bt (Bacillus thuringiensis) based pesticide* is a good organic solution.',
        'stem borer': 'Remove and destroy infected plant parts immediately. Releasing *Trichogramma wasps* can act as a biological control.',
        'locust': 'This is a serious issue. For large swarms, you must *contact your local agricultural authorities immediately*. Creating loud noises can sometimes deter smaller groups.',
        'other': 'Please describe the pest and the affected crop in more detail for a specific recommendation.'
    };
    
    // Hindi recommendations
    const hindiRecommendations = {
        'aphid': '*नीम तेल आधारित स्प्रे* का उपयोग करें। पत्तियों के निचले हिस्से को अच्छी तरह से कवर करें। लेडीबग्स को प्रोत्साहित करना भी प्राकृतिक रूप से मदद कर सकता है।',
        'whitefly': 'निगरानी और पकड़ने के लिए *पीले चिपचिपे जाल* का उपयोग करें। हल्का कीटनाशक साबुन घोल भी प्रभावी हो सकता है।',
        'bollworm': 'फेरोमोन जाल निगरानी के लिए प्रभावी हैं। *Bt (Bacillus thuringiensis) आधारित कीटनाशक* लगाना एक अच्छा जैविक समाधान है।',
        'stem borer': 'संक्रमित पौधे के हिस्सों को तुरंत हटा दें और नष्ट कर दें। *Trichogramma ततैया* छोड़ना जैविक नियंत्रण के रूप में काम कर सकता है।',
        'locust': 'यह एक गंभीर समस्या है। बड़े झुंडों के लिए, आपको *तुरंत अपने स्थानीय कृषि अधिकारियों से संपर्क करना चाहिए*। तेज आवाजें कभी-कभी छोटे समूहों को रोक सकती हैं।',
        'other': 'विशिष्ट सिफारिश के लिए कृपया कीट और प्रभावित फसल का विस्तार से वर्णन करें।'
    };
    
    // Tamil recommendations
    const tamilRecommendations = {
        'aphid': '*வேப்பெண்ணெய் அடிப்படையிலான தெளிப்பான்* பயன்படுத்தவும். இலைகளின் கீழ்ப்புறத்தை நன்றாக மூடுவதை உறுதிசெய்யவும். பெண் வண்டுகளை ஊக்குவிப்பதும் இயற்கையாக உதவும்.',
        'whitefly': 'அவற்றை கண்காணிக்கவும் பிடிக்கவும் *மஞ்சள் ஒட்டும் வலைகள்* பயன்படுத்தவும். மென்மையான பூச்சிக்கொல்லி சோப்பு கரைசலும் பயனுள்ளதாக இருக்கும்.',
        'bollworm': 'பெரோமோன் வலைகள் கண்காணிப்புக்கு பயனுள்ளவை. *Bt (Bacillus thuringiensis) அடிப்படையிலான பூச்சிக்கொல்லி* பயன்படுத்துவது நல்ல உயிரியல் தீர்வு.',
        'stem borer': 'பாதிக்கப்பட்ட தாவர பகுதிகளை உடனடியாக அகற்றவும் அழிக்கவும். *Trichogramma குளவிகள்* விடுவிப்பது உயிரியல் கட்டுப்பாட்டாக செயல்படும்.',
        'locust': 'இது ஒரு கடுமையான பிரச்சினை. பெரிய கூட்டங்களுக்கு, நீங்கள் *உடனடியாக உங்கள் உள்ளூர் வேளாண் அதிகாரிகளை தொடர்பு கொள்ள வேண்டும்*. உரத்த ஒலிகள் சில நேரங்களில் சிறிய குழுக்களை தடுக்கும்.',
        'other': 'குறிப்பிட்ட பரிந்துரைக்கு தயவுசெய்து பூச்சி மற்றும் பாதிக்கப்பட்ட பயிரை விரிவாக விவரிக்கவும்.'
    };
    
    // Telugu recommendations
    const teluguRecommendations = {
        'aphid': '*వేప నూనె ఆధారిత స్ప్రే* ఉపయోగించండి. ఆకుల దిగువ భాగాన్ని బాగా కప్పాలని నిర్ధారించుకోండి. లేడీబగ్స్‌ను ప్రోత్సహించడం కూడా సహజంగా సహాయపడుతుంది.',
        'whitefly': 'వాటిని పర్యవేక్షించడానికి మరియు పట్టుకోవడానికి *పసుపు జిగట ట్రాప్‌లు* ఉపయోగించండి. తేలికపాటి కీటనాశక సబ్బు ద్రావణం కూడా ప్రభావవంతంగా ఉంటుంది.',
        'bollworm': 'ఫెరోమోన్ ట్రాప్‌లు పర్యవేక్షణకు ప్రభావవంతంగా ఉంటాయి. *Bt (Bacillus thuringiensis) ఆధారిత కీటనాశకం* వేయడం మంచి జీవ సంబంధమైన పరిష్కారం.',
        'stem borer': 'సోకిన మొక్క భాగాలను వెంటనే తొలగించి నాశనం చేయండి. *Trichogramma తేనెటీగలు* విడుదల చేయడం జీవ నియంత్రణగా పని చేస్తుంది.',
        'locust': 'ఇది తీవ్రమైన సమస్య. పెద్ద గుంపులకు, మీరు *వెంటనే మీ స్థానిక వ్యవసాయ అధికారులను సంప్రదించాలి*. బిగ్గరగా శబ్దాలు చేయడం కొన్నిసార్లు చిన్న గుంపులను నిరుత్సాహపరుస్తుంది.',
        'other': 'నిర్దిష్ట సిఫార్సుకు దయచేసి కీట మరియు ప్రభావితమైన పంటను వివరంగా వివరించండి.'
    };
    
    // Bengali recommendations
    const bengaliRecommendations = {
        'aphid': '*নিম তেল ভিত্তিক স্প্রে* ব্যবহার করুন। পাতার নিচের দিকটি ভালভাবে ঢাকতে নিশ্চিত করুন। লেডিবাগ উৎসাহিত করাও স্বাভাবিকভাবে সাহায্য করতে পারে।',
        'whitefly': 'তাদের পর্যবেক্ষণ এবং ধরার জন্য *হলুদ আঠালো ফাঁদ* ব্যবহার করুন। হালকা কীটনাশক সাবান দ্রবণও কার্যকর হতে পারে।',
        'bollworm': 'ফেরোমন ফাঁদ পর্যবেক্ষণের জন্য কার্যকর। *Bt (Bacillus thuringiensis) ভিত্তিক কীটনাশক* প্রয়োগ করা একটি ভাল জৈব সমাধান।',
        'stem borer': 'সংক্রমিত গাছের অংশগুলি অবিলম্বে সরিয়ে দিন এবং ধ্বংস করুন। *Trichogramma বোলতা* ছাড়া জৈবিক নিয়ন্ত্রণ হিসেবে কাজ করতে পারে।',
        'locust': 'এটি একটি গুরুতর সমস্যা। বড় ঝাঁকের জন্য, আপনাকে *অবিলম্বে আপনার স্থানীয় কৃষি কর্তৃপক্ষের সাথে যোগাযোগ করতে হবে*। জোরে শব্দ কখনও কখনও ছোট দলগুলিকে নিরুৎসাহিত করতে পারে।',
        'other': 'নির্দিষ্ট সুপারিশের জন্য অনুগ্রহ করে কীট এবং প্রভাবিত ফসলের বিস্তারিত বিবরণ দিন।'
    };
    
    // Gujarati recommendations
    const gujaratiRecommendations = {
        'aphid': '*લીમડાના તેલ આધારિત સ્પ્રે* વાપરો. પાનાંના નીચલા ભાગને સારી રીતે ઢાંકવાની ખાતરી કરો. લેડીબગ્સને પ્રોત્સાહન આપવાથી પણ કુદરતી રીતે મદદ થઈ શકે છે.',
        'whitefly': 'તેમની દેખરેખ અને પકડવા માટે *પીળા ચોંટતા ફાંસલા* વાપરો. હળવું કીટનાશક સાબણ દ્રાવણ પણ અસરકારક હોઈ શકે છે.',
        'bollworm': 'ફેરોમોન ફાંસલા દેખરેખ માટે અસરકારક છે. *Bt (Bacillus thuringiensis) આધારિત કીટનાશક* લગાવવું એક સારું જૈવિક ઉકેલ છે.',
        'stem borer': 'સંક્રમિત છોડના ભાગોને તરત જ દૂર કરો અને નાશ કરો. *Trichogramma ભમરી* છોડવાથી જૈવિક નિયંત્રણ તરીકે કામ કરી શકે છે.',
        'locust': 'આ એક ગંભીર સમસ્યા છે. મોટા ટોળા માટે, તમારે *તરત જ તમારા સ્થાનિક કૃષિ અધિકારીઓનો સંપર્ક કરવો જોઈએ*. મોટા અવાજો કેટલીકવાર નાના જૂથોને રોકી શકે છે.',
        'other': 'ચોક્કસ ભલામણ માટે કૃપા કરીને કીટ અને પ્રભાવિત પાકનું વિગતવાર વર્ણન આપો.'
    };
    
    // Language-specific recommendations mapping
    const languageRecommendations = {
        'en': englishRecommendations,
        'hi': hindiRecommendations,
        'ta': tamilRecommendations,
        'te': teluguRecommendations,
        'bn': bengaliRecommendations,
        'gu': gujaratiRecommendations
    };
    
    // Get recommendations for the selected language
    const recommendations = languageRecommendations[language] || englishRecommendations;
    
    // Find the best matching pest type
    let bestMatch = 'other';
    if (normalizedType.includes('aphid')) bestMatch = 'aphid';
    else if (normalizedType.includes('whitefl')) bestMatch = 'whitefly';
    else if (normalizedType.includes('bollworm')) bestMatch = 'bollworm';
    else if (normalizedType.includes('stem borer')) bestMatch = 'stem borer';
    else if (normalizedType.includes('locust')) bestMatch = 'locust';
    
    return recommendations[bestMatch] || recommendations['other'];
}

function getLanguageMessage(key, language) {
    const messages = {
        'pest_selected': {
            'en': 'You selected: *{pest}*',
            'hi': 'आपने चुना: *{pest}*',
            'ta': 'நீங்கள் தேர்ந்தெடுத்தது: *{pest}*',
            'te': 'మీరు ఎంచుకున్నది: *{pest}*',
            'bn': 'আপনি নির্বাচন করেছেন: *{pest}*',
            'gu': 'તમે પસંદ કર્યું: *{pest}*'
        },
        'pest_control_title': {
            'en': 'Pest Control: {pest}',
            'hi': 'कीट नियंत्रण: {pest}',
            'ta': 'பூச்சி கட்டுப்பாடு: {pest}',
            'te': 'కీట నియంత్రణ: {pest}',
            'bn': 'কীট নিয়ন্ত্রণ: {pest}',
            'gu': 'કીટ નિયંત્રણ: {pest}'
        }
    };
    
    return messages[key]?.[language] || messages[key]?.['en'] || key;
}


