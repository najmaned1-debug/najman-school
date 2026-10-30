# Najman USSD

Huduma ya USSD kwa wazazi: Ada/Deni, Matokeo, Mahudhurio, Taarifa za Shule.
Mzazi anatambuliwa kwa **namba ya simu anayopiga** (lazima iwe ile iliyosajiliwa kwa mwanafunzi kwenye mfumo).

## Kuweka (Supabase)
1. Supabase -> Edge Functions -> Create function, jina: `ussd`. Bandika yaliyomo ya `index.ts` (faili moja).
2. Zima "Verify JWT" kwa function hii (aggregator hawatumi JWT).
3. Edge Functions -> Secrets: ongeza `USSD_KEY` = nenosiri refu la siri (herufi/namba 24+).
   (`SUPABASE_URL` na `SUPABASE_SERVICE_ROLE_KEY` zipo moja kwa moja.)
4. Callback URL: `https://yubucetzjjjhcrpnnoal.supabase.co/functions/v1/ussd?key=<USSD_KEY>`

## Kujaribu
Fungua `ussd-simulator.html` (kwenye tovuti ya shule), weka URL, key na namba ya mzazi.

## Kupata namba ya USSD halisi
Inahitaji mtoa huduma (aggregator) kama Africa's Talking, Beem au kampuni ya simu (Vodacom, Tigo, Airtel, Halotel)
na kusajili shortcode (mf. *384*123#). Wanatuma POST `sessionId, phoneNumber, text` na kutarajia jibu `CON ...` au `END ...`.
