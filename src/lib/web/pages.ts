export type SupportedLang = 'cs' | 'en';

export const parseLang = (queryLang?: unknown): SupportedLang => {
    if (queryLang === 'en') return 'en';
    return 'cs';
};

const renderFooter = (): string => `
<footer style="margin-top: 48px; border-top: 1px solid #27272a; padding-top: 24px; font-size: 14px; color: #71717a; text-align: center;">
    <p style="margin: 0 0 8px 0;">Kontakt / Contact: <a href="mailto:patrik@mintel.cz" style="color: #a1a1aa; text-decoration: underline;">patrik@mintel.cz</a></p>
    <p style="margin: 0;"><a href="https://patrik.mintel.cz" target="_blank" rel="noopener noreferrer" style="color: #a1a1aa; text-decoration: underline;">patrik.mintel.cz</a></p>
</footer>
`;

const renderLayout = (
    title: string,
    bodyContent: string,
    isCenter = false
): string => `<!DOCTYPE html>
<html lang="cs">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - Minonka</title>
    <style>
        :root {
            color-scheme: dark;
        }
        body {
            background-color: #121212;
            color: #d4d4d8;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            font-size: 16px;
            line-height: 1.7;
            margin: 0;
            padding: 40px 20px;
        }
        main {
            max-width: 760px;
            margin: 0 auto;
            ${isCenter ? 'min-height: calc(80vh - 120px); display: flex; flex-direction: column; justify-content: center; align-items: center;' : ''}
        }
        h1 {
            color: #ffffff;
            font-size: 2rem;
            margin-top: 0;
            margin-bottom: 0.5rem;
            font-weight: 700;
        }
        h2 {
            color: #f4f4f5;
            font-size: 1.35rem;
            margin-top: 2rem;
            margin-bottom: 0.5rem;
            font-weight: 600;
        }
        p, li {
            margin-top: 0;
            margin-bottom: 1rem;
        }
        ul {
            padding-left: 1.5rem;
            margin-bottom: 1rem;
        }
        a {
            color: #a1a1aa;
            text-decoration: underline;
        }
        a:hover {
            color: #ffffff;
        }
        .meta {
            color: #71717a;
            font-size: 0.9rem;
            margin-bottom: 2rem;
        }
        .lang-switch {
            margin-bottom: 2rem;
            font-size: 0.9rem;
            color: #71717a;
        }
        .center-buttons {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 16px;
            width: 100%;
        }
        .btn {
            display: inline-block;
            padding: 14px 28px;
            background-color: #27272a;
            color: #f4f4f5;
            border: 1px solid #3f3f46;
            border-radius: 6px;
            text-decoration: none;
            font-size: 16px;
            font-weight: 500;
            text-align: center;
            width: 300px;
            box-sizing: border-box;
        }
        .btn:hover {
            background-color: #3f3f46;
            color: #ffffff;
        }
    </style>
</head>
<body>
    <main>
        ${bodyContent}
    </main>
    ${renderFooter()}
</body>
</html>
`;

export const renderIndex = (): string => {
    const content = `
        <div class="center-buttons">
            <a href="/terms" class="btn">Podmínky využívání služeb<br><span style="font-size: 13px; color: #a1a1aa;">Terms of Service</span></a>
            <a href="/privacy" class="btn">Zásady ochrany osobních údajů<br><span style="font-size: 13px; color: #a1a1aa;">Privacy Policy</span></a>
        </div>
    `;
    return renderLayout('Minonka', content, true);
};

export const renderTerms = (lang: SupportedLang): string => {
    const langSwitch = `
        <div class="lang-switch">
            ${lang === 'cs' ? '<strong>Čeština</strong> | <a href="/terms?lang=en">English</a>' : '<a href="/terms?lang=cs">Čeština</a> | <strong>English</strong>'}
        </div>
    `;

    if (lang === 'cs') {
        const content = `
            ${langSwitch}
            <h1>Podmínky využívání služeb</h1>
            <p class="meta">Poslední aktualizace: 22. září 2026</p>

            <h2>1. Úvodní ustanovení</h2>
            <p>Minonka je Discord aplikace (bot) poskytující herní statistiky, historii zápasů, sledování živých her a související informace pro hru League of Legends. Používáním aplikace Minonka v libovolném prostředí (servery, soukromé zprávy, skupinové konverzace) vyjadřujete souhlas s těmito podmínkami.</p>

            <h2>2. Pravidla užívání</h2>
            <p>Uživatel se zavazuje nepoužívat aplikaci k činnostem, které by narušovaly její provoz, přetěžovaly servery, obcházely omezení nebo porušovaly Podmínky používání služby Discord a pravidla společnosti Riot Games.</p>

            <h2>3. Data a rozhraní třetích stran</h2>
            <p>Minonka získává data prostřednictvím oficiálního rozhraní Riot Games API. Provozovatel neručí za výpadky, nepřesnosti nebo změny způsobené nedostupností či změnami na straně externích služeb.</p>

            <h2>4. Právní doložka Riot Games</h2>
            <p>Minonka isn’t endorsed by Riot Games and doesn’t reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.</p>

            <h2>5. Dostupnost a změny služby</h2>
            <p>Aplikace je poskytována tak, jak je („as is“), bez jakýchkoliv záruk. Provozovatel si vyhrazuje právo aplikaci kdykoliv upravit, omezit nebo ukončit její provoz.</p>

            <h2>6. Omezení odpovědnosti</h2>
            <p>Provozovatel nenese odpovědnost za jakékoliv přímé či nepřímé škody vzniklé v souvislosti s používáním nebo nemožností používat tuto aplikaci.</p>
        `;
        return renderLayout('Podmínky využívání služeb', content);
    }

    const content = `
        ${langSwitch}
        <h1>Terms of Service</h1>
        <p class="meta">Last updated: September 22, 2026</p>

        <h2>1. Introduction</h2>
        <p>Minonka is a Discord application (bot) providing League of Legends player statistics, match histories, live spectator tracking, and related game data. By using or adding Minonka in any context (servers, direct messages, or group chats), you agree to these Terms of Service.</p>

        <h2>2. Acceptable Use</h2>
        <p>You agree not to misuse the application, spam commands, attempt to disrupt its infrastructure, reverse engineer unauthorized services, or violate Discord's Terms of Service or Riot Games' policies.</p>

        <h2>3. Third-Party Data & APIs</h2>
        <p>Minonka relies on the official Riot Games API to retrieve game information. We are not liable for any service interruptions, delays, or data inaccuracies arising from third-party services.</p>

        <h2>4. Riot Games Disclaimer</h2>
        <p>Minonka isn’t endorsed by Riot Games and doesn’t reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.</p>

        <h2>5. Availability & Changes</h2>
        <p>The service is provided on an "as is" and "as available" basis without warranties of any kind. The operator reserves the right to modify, restrict, or discontinue any feature at any time without prior notice.</p>

        <h2>6. Limitation of Liability</h2>
        <p>To the maximum extent permitted by law, the operator shall not be held liable for any direct, indirect, incidental, or consequential damages resulting from the use or inability to use this service.</p>
    `;
    return renderLayout('Terms of Service', content);
};

export const renderPrivacy = (lang: SupportedLang): string => {
    const langSwitch = `
        <div class="lang-switch">
            ${lang === 'cs' ? '<strong>Čeština</strong> | <a href="/privacy?lang=en">English</a>' : '<a href="/privacy?lang=cs">Čeština</a> | <strong>English</strong>'}
        </div>
    `;

    if (lang === 'cs') {
        const content = `
            ${langSwitch}
            <h1>Zásady ochrany osobních údajů</h1>
            <p class="meta">Poslední aktualizace: 22. září 2026</p>

            <h2>1. Jaká data shromažďujeme</h2>
            <p>Minonka zpracovává a ukládá pouze nezbytná data potřebná pro fungování jejích funkcí:</p>
            <ul>
                <li><strong>Discord identifikátory:</strong> Vaše Discord User ID (při propojení Riot účtu přes příkaz <code>/link</code> nebo uložení uživatelských předvoleb).</li>
                <li><strong>Riot Games herní údaje:</strong> Veřejný herní identifikátor (gameName#tagLine), PUUID a herní region, které sami propojíte.</li>
                <li><strong>Uživatelská nastavení:</strong> Jazykové předvolby a výchozí parametry příkazů nastavené přes <code>/settings</code>.</li>
                <li><strong>Dočasná provozní data:</strong> Dočasná mezipaměť (cache) pro generování statistik a sledování aktivních spectator zápasů.</li>
            </ul>

            <h2>2. Data, která NESHROMAŽĎUJEME</h2>
            <p>Minonka v žádném případě neshromažďuje:</p>
            <ul>
                <li>Hesla ani přihlašovací údaje k Riot Games ani Discordu.</li>
                <li>Soukromé zprávy, obsah chatu ani historii zpráv.</li>
                <li>E-maily, skutečná jména, platební údaje ani IP adresy uživatelů.</li>
            </ul>

            <h2>3. Využití dat</h2>
            <p>Uložená data jsou využívána výhradně pro komunikaci s Riot Games API za účelem vygenerování požadovaných herních statistik a profilů. Žádná data nejsou předávána třetím stranám, prodávána ani využívána pro marketingové účely.</p>

            <h2>4. Uchovávání a smazání dat</h2>
            <p>Údaje jsou uchovávány po dobu používání aplikace. Svá data můžete kdykoliv sami spravovat nebo smazat:</p>
            <ul>
                <li>Odpojení propojených Riot účtů provedete příkazem <code>/links</code> (výběrem účtu k odpojení).</li>
                <li>Smazání uživatelských nastavení provedete příkazem <code>/settings</code>.</li>
                <li>Kompletní smazání všech záznamů vázaných na vaše Discord ID můžete kdykoliv vyžádat na e-mailu <code>patrik@mintel.cz</code>.</li>
            </ul>
        `;
        return renderLayout('Zásady ochrany osobních údajů', content);
    }

    const content = `
        ${langSwitch}
        <h1>Privacy Policy</h1>
        <p class="meta">Last updated: September 22, 2026</p>

        <h2>1. Data We Collect</h2>
        <p>Minonka collects and stores only the minimum data required to deliver its features:</p>
        <ul>
            <li><strong>Discord User ID:</strong> Stored when you link your Riot account (via <code>/link</code>) or configure command presets.</li>
            <li><strong>Riot Games Account Info:</strong> Your public Riot ID (gameName#tagLine), PUUID, and region that you explicitly link.</li>
            <li><strong>User Settings:</strong> Custom language and default command preferences configured via <code>/settings</code>.</li>
            <li><strong>Temporary Operational Data:</strong> Ephemeral caching for match graphics and active spectator tracking sessions.</li>
        </ul>

        <h2>2. Data We DO NOT Collect</h2>
        <p>Minonka never collects or stores:</p>
        <ul>
            <li>Passwords or credentials for Riot Games or Discord.</li>
            <li>Private messages, chat history, or message content.</li>
            <li>Email addresses, real names, payment details, or IP addresses.</li>
        </ul>

        <h2>3. How We Use Data</h2>
        <p>Stored data is used exclusively to query the Riot Games API and render game performance graphics requested by you. We never sell, rent, or share personal data with third parties or advertisers.</p>

        <h2>4. Data Retention & Deletion Rights</h2>
        <p>Data is retained until you remove it or request deletion:</p>
        <ul>
            <li>You can unlink any Riot account instantly using the <code>/links</code> command.</li>
            <li>You can reset your command preferences using <code>/settings</code>.</li>
            <li>You can request permanent deletion of all data associated with your Discord account by contacting <code>patrik@mintel.cz</code>.</li>
        </ul>
    `;
    return renderLayout('Privacy Policy', content);
};
