import type { Locale } from './index';

export interface HelpItem {
  q: string;
  a: string;
}
export interface HelpSection {
  title: string;
  items: HelpItem[];
}
export interface HelpContent {
  /** Për çdo përdorues */
  common: HelpSection[];
  /** Vetëm për punëtorët */
  worker: HelpSection[];
  /** Vetëm për pronarin */
  admin: HelpSection[];
}

export const HELP: Record<Locale, HelpContent> = {
  sq: {
    worker: [
      {
        title: 'Orari i punës',
        items: [
          { q: 'Si e nis ditën e punës?', a: 'Hap faqen "Sot" dhe shtyp butonin e gjelbër START. Zgjidh Baushtellën ku po punon nga lista; pa zgjedhur Baushtellë nuk niset dita.' },
          { q: 'Si e bëj pauzën?', a: 'Shtyp PAUZË kur e nis pauzën dhe WEITER (vazhdo) kur kthehesh në punë. Pauza nuk numërohet si orë pune.' },
          { q: 'Si e mbyll ditën?', a: 'Shtyp STOP dhe konfirmo. Aplikacioni të pyet sa pauzë ke bërë gjithsej atë ditë. Sipas ligjit duhen të paktën 30 min. pauzë pas 6 orësh dhe 45 min. pas 9 orësh.' },
          { q: 'Harrova të shtyp STOP. Çfarë bëj?', a: 'Lajmëroje pronarin. Ai mund ta korrigjojë turnin dhe çdo korrigjim ruhet me arsyen e tij.' },
        ],
      },
      {
        title: 'Orët e mia',
        items: [
          { q: 'Ku i shoh orët që kam punuar?', a: 'Te tab-i "Orët" shfaqen turnet e muajit dhe totali. Me shigjetat ‹ › kalon te muajt e tjerë.' },
          { q: 'Pse një turn ka një paralajmërim?', a: 'Aplikacioni të njofton kur ka më shumë se 10 orë punë, pauzë të shkurtër, punë të dielën ose në festë, ose më pak se 11 orë pushim mes dy turneve. Është vetëm njoftim.' },
        ],
      },
      {
        title: 'Pa internet',
        items: [
          { q: 'Si e vendos rutinën time?', a: 'Te Profili, në grupin "Puna", prek "Rutina". Ndize "Regjistro automatikisht", zgjidh ditët e javës, orën e fillimit dhe të fundit, pauzën (nga ora dhe sa minuta) dhe Baushtellën ku punon, pastaj shtyp Ruaj.' },
          { q: 'Çfarë ndodh kur rutina është e ndezur?', a: 'Serveri e fillon turnin vetë në orën e caktuar, e fillon dhe e mbyll pauzën, dhe e mbyll turnin në orën e fundit, edhe kur aplikacioni është i mbyllur. Këto orë shënohen "automatike". Rutina vlen nga ora e ardhshme e fillimit, jo prapa në kohë.' },
          { q: 'Një ditë punoj ndryshe ose nuk punoj. Çfarë bëj?', a: 'Te Rutina ose te faqja "Sot" shtyp "Anashkalo sot" para se të nisë dita. Nëse turni ka nisur, shtyp "Ndalo tani". Mund ta fikësh rutinën edhe plotësisht.' },
          { q: 'Çfarë ndodh nëse nuk kam sinjal në kantier?', a: 'START, PAUZË dhe STOP ruhen në telefon dhe dërgohen vetë kur kthehet interneti. Në krye të faqes "Sot" sheh nëse çdo gjë është dërguar.' },
          { q: 'Pse nuk më lë të dal nga llogaria?', a: 'Kur ka orë që nuk janë dërguar ende, dalja bllokohet që ato të mos humbasin. Prit sa të dërgohen (lidhu me internet) dhe provo përsëri.' },
        ],
      },
    ],
    admin: [
      {
        title: 'Kryefaqja dhe punëtorët',
        items: [
          { q: 'Çfarë tregon Kryefaqja?', a: 'Kartat e Baushtellave aktive me foto dhe sa punëtorë janë tani aty. Prek një kartë për të parë kush është në punë, që nga ora dhe a është në pauzë.' },
          { q: 'Si e shtoj një punëtor të ri?', a: 'Te tab-i "Punëtorët" shtyp "Shto punëtor". Cakto një emër përdoruesi (shkronja ose shifra, deri në 12), një PIN me 6 shifra dhe tarifën për orë. Pas krijimit shfaqen të dhënat e kyçjes: jepja punëtorit, sepse PIN-i nuk shfaqet më.' },
          { q: 'Punëtori harroi PIN-in.', a: 'Hap punëtorin te "Punëtorët", shkruaj ose gjenero një PIN të ri te "Rivendos PIN-in" dhe shtyp Ruaj. Pastaj jepja punëtorit.' },
          { q: 'Si e ndryshoj tarifën?', a: 'Hap punëtorin dhe vendos "Tarifë të re nga sot". Muajt e kaluar nuk ndryshojnë, sepse tarifat ruhen me datë.' },
          { q: 'Dikush nuk punon më te ne.', a: 'Hap punëtorin dhe shtyp "Çaktivizo". Ai kalon te "Jo aktivë" dhe nuk mund të kyçet, por orët e tij ruhen për raportet. Orët nuk fshihen, sepse ligji i kërkon të ruhen 2 vjet.' },
        ],
      },
      {
        title: 'Orët dhe korrigjimet',
        items: [
          { q: 'Si i shoh orët e një punëtori?', a: 'Te tab-i "Orët" zgjidh punëtorin me butonin sipër, pastaj muajin me shigjetat.' },
          { q: 'Si e korrigjoj një turn?', a: 'Prek turnin, ndrysho orën e fillimit, të fundit ose pauzën dhe shkruaj arsyen (e detyrueshme). Çdo korrigjim ruhet me datën dhe arsyen, dhe punëtori e sheh që është korrigjuar nga zyra.' },
          { q: 'Çfarë do të thotë "më shumë se 13 orë pa STOP"?', a: 'Turni ka mbetur i hapur: ka të ngjarë që punëtori ka harruar STOP. Korrigjoje turnin që ta mbyllësh.' },
        ],
      },
      {
        title: 'Baushtellat dhe terminet',
        items: [
          { q: 'Si e shtoj një Baushtellë?', a: 'Te Profili hap "Baushtellat" dhe shtyp "Shto Baushtellë". Shkruaj emrin dhe adresën dhe shto një foto (ngarkohet e zvogëluar, kështu kursen internet). Foto shfaqet te Kryefaqja.' },
          { q: 'Çfarë ndodh kur një Baushtellë përfundon?', a: 'Vendose "Përfunduar". Punëtorët nuk e shohin më për të zgjedhur, por orët e tyre mbeten te raportet.' },
          { q: 'A e zgjedh punëtori gjithmonë Baushtellën?', a: 'Po. Kur shtyp START duhet të zgjedhë një nga Baushtellat aktive, kështu çdo orë lidhet me një vend pune. Nëse nuk ka asnjë Baushtellë aktive, START niset pa zgjedhje, prandaj shto Baushtellat te Profili.' },
          { q: 'Si i përdor Terminet?', a: 'Tab-i "Terminet" është për takimet e tua (klientë, vizita). Shto një termin me titull, datë, orë, vend dhe shënime. Terminet e kaluara ose të kryera shfaqen te "Të kaluara".' },
        ],
      },
      {
        title: 'Raporti mujor dhe mbyllja',
        items: [
          { q: 'Si e shkarkoj raportin e muajit?', a: 'Te tab-i "Muaji" shtyp "Shkarko PDF". Merr Stundenabrechnung-un për të gjithë punëtorët: përmbledhjen, orët për Baushtellë dhe turnet e secilit.' },
          { q: 'Si e marr fletën e orëve të një punëtori?', a: 'Te "Muaji" prek rreshtin e punëtorit dhe shtyp "Shkarko fletën e orëve (PDF)". Është Arbeitszeitnachweis i gatshëm për nënshkrim. Mund të zgjedhësh nëse të përfshihet paga.' },
          { q: 'Çfarë bën "Mbyll muajin"?', a: 'Mbyllet vetëm muaji i atij punëtori: orët e tij nuk mund të ndryshohen më nga askush dhe ruhet një kopje e raportit. Punëtorët e tjerë mbeten të hapur. Nuk kthehet mbrapsht, prandaj mbylle kur raporti është i saktë.' },
          { q: 'Pse nuk mund ta mbyll muajin?', a: 'Punëtori ka një turn të hapur (harroi STOP). Korrigjoje turnin te "Orët" dhe provo përsëri.' },
        ],
      },
    ],
    common: [
      {
        title: 'Mesazhet',
        items: [
          { q: 'Si i shkruaj stafit?', a: 'Prek ikonën e dërgimit (aeroplanin e letrës) lart djathtas, ose rrëshqit ekranin me gisht nga e djathta në të majtë. Hapet lista e bisedave.' },
          { q: 'Çfarë janë grupet e Baushtellave?', a: 'Çdo Baushtellë aktive ka një grup ku shkruajnë dhe lexojnë të gjithë punonjësit. Kur një Baushtellë përfundon, grupi nuk shfaqet më.' },
          { q: 'Si i shkruaj një personi vetëm?', a: 'Në listën e bisedave shtyp + dhe zgjidh personin. Mesazhet private i shohin vetëm ju të dy, as pronari nuk i sheh bisedat e të tjerëve.' },
          { q: 'Pse nuk dërgohet mesazhi?', a: 'Mesazhet dërgohen vetëm kur ke internet. Kontrollo lidhjen dhe shtyp dërgo përsëri: teksti që shkrove mbetet në fushë.' },
        ],
      },
      {
        title: 'Llogaria',
        items: [
          { q: 'Si e ndryshoj emrin ose PIN-in?', a: 'Te Profili, në grupin "Llogaria", prek "Ndrysho emrin" ose "Ndrysho PIN-in". Për PIN-in shkruan së pari atë aktual, pastaj dy herë atë të ri (6 shifra, jo shumë i thjeshtë). Emrin e përdoruesit për kyçje mund ta ndryshojë vetëm pronari.' },
          { q: 'Si e ndryshoj fotografinë?', a: 'Te Profili prek foton ose "Ndërro foton" dhe zgjidh një foto nga galeria. Ajo zvogëlohet vetë.' },
          { q: 'Si e ndryshoj gjuhën?', a: 'Te Profili prek "Gjuha" dhe zgjidh Shqip, Deutsch ose English.' },
          { q: 'Si e fshij llogarinë time?', a: 'Te Profili prek "Kërko fshirjen e llogarisë". Hapet një email te kompania, e cila e kryen kërkesën. Orët e punës ruhen sipas ligjit për 2 vjet.' },
        ],
      },
      {
        title: 'Ndihmë',
        items: [
          { q: 'Nuk po kyçem.', a: 'Kontrollo emrin e përdoruesit (shkronjat e mëdha nuk kanë rëndësi) dhe PIN-in me 6 shifra. Nëse e ke harruar PIN-in, kërkoji pronarit ta rivendosë.' },
        ],
      },
    ],
  },

  de: {
    worker: [
      {
        title: 'Arbeitszeit',
        items: [
          { q: 'Wie starte ich meinen Arbeitstag?', a: 'Öffne "Heute" und tippe auf den grünen START-Knopf. Wähle die Baustelle, auf der du arbeitest, aus der Liste; ohne Baustelle startet der Tag nicht.' },
          { q: 'Wie mache ich Pause?', a: 'Tippe auf PAUSE, wenn die Pause beginnt, und auf WEITER, wenn du wieder arbeitest. Pausen zählen nicht als Arbeitszeit.' },
          { q: 'Wie beende ich den Arbeitstag?', a: 'Tippe auf STOP und bestätige. Die App fragt, wie viel Pause du insgesamt gemacht hast. Gesetzlich sind mindestens 30 Min. Pause nach 6 Stunden und 45 Min. nach 9 Stunden vorgeschrieben.' },
          { q: 'Ich habe STOP vergessen. Was tun?', a: 'Sag dem Büro Bescheid. Es kann die Schicht korrigieren, jede Korrektur wird mit Begründung gespeichert.' },
        ],
      },
      {
        title: 'Meine Stunden',
        items: [
          { q: 'Wo sehe ich meine gearbeiteten Stunden?', a: 'Im Tab "Meine Stunden" siehst du die Schichten des Monats und die Summe. Mit ‹ › wechselst du den Monat.' },
          { q: 'Warum hat eine Schicht einen Hinweis?', a: 'Die App weist dich auf mehr als 10 Stunden Arbeit, zu kurze Pausen, Sonntags- oder Feiertagsarbeit und weniger als 11 Stunden Ruhezeit hin. Es ist nur ein Hinweis.' },
        ],
      },
      {
        title: 'Ohne Internet',
        items: [
          { q: 'Wie lege ich meine Routine fest?', a: 'Im Profil in der Gruppe "Arbeit" auf "Routine" tippen. "Automatisch erfassen" einschalten, Wochentage, Beginn und Ende, Pause (ab wann und wie viele Minuten) und die Baustelle wählen und Speichern tippen.' },
          { q: 'Was passiert, wenn die Routine eingeschaltet ist?', a: 'Der Server startet die Schicht zur eingestellten Zeit von selbst, startet und beendet die Pause und beendet die Schicht zur Endzeit, auch wenn die App geschlossen ist. Diese Stunden sind als "automatisch" markiert. Die Routine gilt ab dem nächsten Beginn, nicht rückwirkend.' },
          { q: 'Ich arbeite an einem Tag anders oder gar nicht. Was tun?', a: 'In der Routine oder auf "Heute" tippe vor Beginn des Tages auf "Heute überspringen". Läuft die Schicht schon, tippe auf "Jetzt beenden". Du kannst die Routine auch ganz ausschalten.' },
          { q: 'Was passiert ohne Empfang auf der Baustelle?', a: 'START, PAUSE und STOP werden auf dem Handy gespeichert und automatisch übertragen, sobald du wieder Internet hast. Oben bei "Heute" siehst du, ob alles übertragen ist.' },
          { q: 'Warum kann ich mich nicht abmelden?', a: 'Solange noch Stunden nicht übertragen sind, ist das Abmelden gesperrt, damit nichts verloren geht. Warte, bis alles übertragen ist (Internet verbinden), und versuche es erneut.' },
        ],
      },
    ],
    admin: [
      {
        title: 'Start und Mitarbeiter',
        items: [
          { q: 'Was zeigt die Startseite?', a: 'Die aktiven Baustellen mit Foto und der Zahl der Mitarbeiter, die gerade dort arbeiten. Tippe auf eine Karte, um zu sehen, wer im Dienst ist, seit wann und ob gerade Pause ist.' },
          { q: 'Wie lege ich einen neuen Mitarbeiter an?', a: 'Im Tab "Mitarbeiter" auf "Mitarbeiter hinzufügen" tippen. Vergib einen Benutzernamen (Buchstaben oder Ziffern, höchstens 12), eine 6-stellige PIN und den Stundenlohn. Danach werden die Zugangsdaten angezeigt: gib sie dem Mitarbeiter, die PIN wird nicht mehr angezeigt.' },
          { q: 'Ein Mitarbeiter hat die PIN vergessen.', a: 'Öffne den Mitarbeiter, gib bei "PIN zurücksetzen" eine neue PIN ein oder lass sie erzeugen und tippe auf Speichern. Gib sie dann dem Mitarbeiter.' },
          { q: 'Wie ändere ich den Stundenlohn?', a: 'Öffne den Mitarbeiter und trage "Neuer Stundenlohn ab heute" ein. Vergangene Monate bleiben unverändert, da Löhne mit Datum gespeichert werden.' },
          { q: 'Jemand arbeitet nicht mehr bei uns.', a: 'Öffne den Mitarbeiter und tippe auf "Deaktivieren". Er wechselt zu "Inaktiv" und kann sich nicht mehr anmelden, seine Stunden bleiben für die Berichte erhalten. Stunden werden nicht gelöscht, da sie 2 Jahre aufbewahrt werden müssen.' },
        ],
      },
      {
        title: 'Stunden und Korrekturen',
        items: [
          { q: 'Wie sehe ich die Stunden eines Mitarbeiters?', a: 'Im Tab "Stunden" wählst du oben den Mitarbeiter und mit den Pfeilen den Monat.' },
          { q: 'Wie korrigiere ich eine Schicht?', a: 'Tippe auf die Schicht, ändere Beginn, Ende oder Pause und gib den Grund an (Pflicht). Jede Korrektur wird mit Datum und Grund gespeichert, der Mitarbeiter sieht "Vom Büro korrigiert".' },
          { q: 'Was bedeutet "Mehr als 13 Std. ohne STOP"?', a: 'Die Schicht ist noch offen: vermutlich wurde STOP vergessen. Korrigiere die Schicht, um sie zu beenden.' },
        ],
      },
      {
        title: 'Baustellen und Termine',
        items: [
          { q: 'Wie lege ich eine Baustelle an?', a: 'Im Profil "Baustellen" öffnen und "Baustelle hinzufügen" tippen. Name und Adresse eintragen und ein Foto hinzufügen (wird verkleinert hochgeladen, das spart Datenvolumen). Das Foto erscheint auf der Startseite.' },
          { q: 'Was passiert, wenn eine Baustelle abgeschlossen ist?', a: 'Setze sie auf "Abgeschlossen". Mitarbeiter können sie nicht mehr auswählen, ihre Stunden bleiben in den Berichten.' },
          { q: 'Wählen Mitarbeiter immer eine Baustelle?', a: 'Ja. Bei START muss eine der aktiven Baustellen gewählt werden, so ist jede Stunde einem Einsatzort zugeordnet. Gibt es keine aktive Baustelle, startet START ohne Auswahl: lege Baustellen daher im Profil an.' },
          { q: 'Wie nutze ich die Termine?', a: 'Der Tab "Termine" ist für deine Verabredungen (Kunden, Besichtigungen). Lege einen Termin mit Titel, Datum, Uhrzeit, Ort und Notizen an. Vergangene oder erledigte Termine stehen unter "Vergangen".' },
        ],
      },
      {
        title: 'Monatsbericht und Abschluss',
        items: [
          { q: 'Wie lade ich den Monatsbericht herunter?', a: 'Im Tab "Monat" auf "PDF herunterladen" tippen. Du erhältst die Stundenabrechnung für alle Mitarbeiter: Übersicht, Stunden je Baustelle und die Schichten jedes Mitarbeiters.' },
          { q: 'Wie bekomme ich den Arbeitszeitnachweis eines Mitarbeiters?', a: 'Im Tab "Monat" den Mitarbeiter antippen und "Arbeitszeitnachweis (PDF)" wählen. Er ist unterschriftsbereit. Du kannst wählen, ob der Lohn angezeigt wird.' },
          { q: 'Was macht "Abschließen"?', a: 'Es schließt nur den Monat dieses Mitarbeiters ab: seine Stunden können von niemandem mehr geändert werden und eine Kopie des Berichts wird gespeichert. Die anderen Mitarbeiter bleiben offen. Das ist nicht rückgängig zu machen, schließe also erst ab, wenn der Bericht stimmt.' },
          { q: 'Warum kann ich den Monat nicht abschließen?', a: 'Der Mitarbeiter hat noch eine offene Schicht (STOP vergessen). Korrigiere sie im Tab "Stunden" und versuche es erneut.' },
        ],
      },
    ],
    common: [
      {
        title: 'Nachrichten',
        items: [
          { q: 'Wie schreibe ich dem Team?', a: 'Tippe oben rechts auf das Senden-Symbol (Papierflieger) oder wische mit dem Finger von rechts nach links. Die Chatliste öffnet sich.' },
          { q: 'Was sind die Baustellen-Gruppen?', a: 'Jede aktive Baustelle hat eine Gruppe, in der alle Mitarbeiter schreiben und lesen. Ist eine Baustelle abgeschlossen, wird die Gruppe nicht mehr angezeigt.' },
          { q: 'Wie schreibe ich einer einzelnen Person?', a: 'Tippe in der Chatliste auf + und wähle die Person. Direktnachrichten sehen nur ihr beide, auch das Büro sieht die Chats anderer nicht.' },
          { q: 'Warum wird meine Nachricht nicht gesendet?', a: 'Nachrichten werden nur mit Internet gesendet. Prüfe die Verbindung und sende erneut: dein Text bleibt im Feld stehen.' },
        ],
      },
      {
        title: 'Konto',
        items: [
          { q: 'Wie ändere ich meinen Namen oder die PIN?', a: 'Im Profil in der Gruppe "Konto" auf "Name ändern" oder "PIN ändern" tippen. Für die PIN gibst du zuerst die aktuelle und dann zweimal die neue ein (6 Ziffern, nicht zu einfach). Den Benutzernamen für die Anmeldung kann nur der Inhaber ändern.' },
          { q: 'Wie ändere ich mein Foto?', a: 'Im Profil auf das Foto oder "Foto ändern" tippen und ein Bild aus der Galerie wählen. Es wird automatisch verkleinert.' },
          { q: 'Wie ändere ich die Sprache?', a: 'Im Profil auf "Sprache" tippen und Shqip, Deutsch oder English wählen.' },
          { q: 'Wie lösche ich mein Konto?', a: 'Im Profil auf "Kontolöschung beantragen" tippen. Es öffnet sich eine E-Mail an den Betrieb, der die Löschung durchführt. Arbeitszeiten werden gesetzlich 2 Jahre aufbewahrt.' },
        ],
      },
      {
        title: 'Hilfe',
        items: [
          { q: 'Ich kann mich nicht anmelden.', a: 'Prüfe den Benutzernamen (Groß-/Kleinschreibung egal) und die 6-stellige PIN. Wenn du die PIN vergessen hast, bitte das Büro, sie zurückzusetzen.' },
        ],
      },
    ],
  },

  en: {
    worker: [
      {
        title: 'Working time',
        items: [
          { q: 'How do I start my workday?', a: 'Open "Today" and tap the green START button. Choose the site you are working on from the list; the day does not start without a site.' },
          { q: 'How do I take a break?', a: 'Tap BREAK when the break starts and RESUME when you are back at work. Breaks do not count as working time.' },
          { q: 'How do I finish my day?', a: 'Tap STOP and confirm. The app asks how much break you took in total. By law at least 30 min. of break is required after 6 hours and 45 min. after 9 hours.' },
          { q: 'I forgot to tap STOP. What now?', a: 'Tell the office. They can correct the shift, and every correction is saved with a reason.' },
        ],
      },
      {
        title: 'My hours',
        items: [
          { q: 'Where do I see the hours I worked?', a: 'The "My hours" tab shows the month\'s shifts and the total. Use ‹ › to switch months.' },
          { q: 'Why does a shift show a warning?', a: 'The app flags more than 10 hours of work, breaks that are too short, Sunday or public holiday work, and less than 11 hours of rest. It is only a notice.' },
        ],
      },
      {
        title: 'Offline',
        items: [
          { q: 'How do I set my routine?', a: 'In Profile, in the "Work" group, tap "Routine". Turn on "Record automatically", choose your weekdays, start and end time, break (from when and how many minutes) and the site you work on, then tap Save.' },
          { q: 'What happens when the routine is on?', a: 'The server starts your shift by itself at the set time, starts and ends the break and ends the shift at the end time, even when the app is closed. These hours are marked "automatic". The routine applies from the next start, not retroactively.' },
          { q: 'One day I work differently or not at all. What do I do?', a: 'In Routine or on "Today" tap "Skip today" before the day starts. If the shift has already started, tap "Stop now". You can also turn the routine off completely.' },
          { q: 'What if there is no signal on site?', a: 'START, BREAK and STOP are saved on your phone and sent automatically once you are back online. At the top of "Today" you can see whether everything has been sent.' },
          { q: 'Why can\'t I log out?', a: 'While some hours have not been sent yet, logging out is blocked so nothing gets lost. Wait until everything is sent (connect to the internet) and try again.' },
        ],
      },
    ],
    admin: [
      {
        title: 'Home and employees',
        items: [
          { q: 'What does Home show?', a: 'The active sites with a photo and how many employees are there right now. Tap a card to see who is on duty, since when and whether they are on break.' },
          { q: 'How do I add a new employee?', a: 'In the "Staff" tab tap "Add employee". Set a username (letters or digits, up to 12), a 6-digit PIN and the hourly rate. The login details are shown afterwards: give them to the employee, the PIN is not shown again.' },
          { q: 'An employee forgot their PIN.', a: 'Open the employee, enter or generate a new PIN under "Reset PIN" and tap Save. Then give it to the employee.' },
          { q: 'How do I change an hourly rate?', a: 'Open the employee and enter a "New hourly rate from today". Past months stay unchanged because rates are saved with a date.' },
          { q: 'Someone no longer works for us.', a: 'Open the employee and tap "Deactivate". They move to "Inactive" and can no longer log in, but their hours stay for the reports. Hours are not deleted because they must be kept for 2 years.' },
        ],
      },
      {
        title: 'Hours and corrections',
        items: [
          { q: 'How do I see an employee\'s hours?', a: 'In the "Hours" tab pick the employee with the button at the top, then the month with the arrows.' },
          { q: 'How do I correct a shift?', a: 'Tap the shift, change the start, end or break and enter the reason (required). Every correction is saved with date and reason, and the employee sees "Corrected by the office".' },
          { q: 'What does "More than 13 h without STOP" mean?', a: 'The shift is still open: the employee probably forgot STOP. Correct the shift to close it.' },
        ],
      },
      {
        title: 'Sites and appointments',
        items: [
          { q: 'How do I add a site?', a: 'In Profile open "Sites" and tap "Add site". Enter the name and address and add a photo (uploaded in a reduced size to save data). The photo appears on Home.' },
          { q: 'What happens when a site is finished?', a: 'Set it to "Finished". Employees can no longer pick it, but their hours stay in the reports.' },
          { q: 'Do employees always choose a site?', a: 'Yes. At START one of the active sites must be chosen, so every hour is tied to a place of work. If there is no active site, START begins without a choice, so add sites in Profile.' },
          { q: 'How do I use Appointments?', a: 'The "Appointments" tab is for your own meetings (clients, visits). Add an appointment with title, date, time, place and notes. Past or completed appointments appear under "Past".' },
        ],
      },
      {
        title: 'Monthly report and closing',
        items: [
          { q: 'How do I download the monthly report?', a: 'In the "Month" tab tap "Download PDF". You get the Stundenabrechnung for all employees: overview, hours per site and each employee\'s shifts.' },
          { q: 'How do I get an employee\'s timesheet?', a: 'In "Month" tap the employee and choose "Download timesheet (PDF)". It is ready to sign. You can choose whether to show pay.' },
          { q: 'What does "Close" do?', a: 'It closes only that employee\'s month: nobody can change their hours any more and a copy of the report is saved. Other employees stay open. It cannot be undone, so close only when the report is correct.' },
          { q: 'Why can\'t I close the month?', a: 'The employee still has an open shift (forgot STOP). Correct it in the "Hours" tab and try again.' },
        ],
      },
    ],
    common: [
      {
        title: 'Messages',
        items: [
          { q: 'How do I write to the team?', a: 'Tap the send icon (paper plane) at the top right, or swipe from right to left across the screen. The chat list opens.' },
          { q: 'What are the site groups?', a: 'Every active site has a group where all employees can write and read. When a site is finished, its group is no longer shown.' },
          { q: 'How do I write to one person?', a: 'In the chat list tap + and choose the person. Direct messages are only seen by the two of you; even the owner cannot see the chats of others.' },
          { q: 'Why is my message not sent?', a: 'Messages are only sent when you have internet. Check your connection and send again: your text stays in the field.' },
        ],
      },
      {
        title: 'Account',
        items: [
          { q: 'How do I change my name or PIN?', a: 'In Profile, in the "Account" group, tap "Change name" or "Change PIN". For the PIN enter the current one first, then the new one twice (6 digits, not too simple). Only the owner can change the username used for signing in.' },
          { q: 'How do I change my photo?', a: 'In Profile tap the photo or "Change photo" and pick an image from your gallery. It is resized automatically.' },
          { q: 'How do I change the language?', a: 'In Profile tap "Language" and choose Shqip, Deutsch or English.' },
          { q: 'How do I delete my account?', a: 'In Profile tap "Request account deletion". An email to the company opens, which carries out the request. Working hours must be kept for 2 years by law.' },
        ],
      },
      {
        title: 'Help',
        items: [
          { q: 'I cannot log in.', a: 'Check your username (upper/lower case does not matter) and the 6-digit PIN. If you forgot the PIN, ask the office to reset it.' },
        ],
      },
    ],
  },
};
