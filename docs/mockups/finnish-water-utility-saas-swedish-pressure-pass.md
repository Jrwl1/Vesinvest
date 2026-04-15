# Swedish pressure pass

Grounded in current repo labels from `apps/web/src/i18n/locales/sv.json` plus the v5 mockup changes.

## Safe as-is or safely shorten

| Surface | Finnish | Current / proposed Swedish | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| Step tracker | Valitse | Välj | Low | Good for fixed-width tracker chips. |
| Step tracker | Vuodet | År | Low | Good for fixed-width tracker chips. |
| Step tracker | Tarkista | Granska | Low | Good for fixed-width tracker chips. |
| Step tracker | Pohja | Grund | Low | Good for fixed-width tracker chips. |
| Step tracker | Ennuste | Prognos | Low | Already consistent with current tab naming. |
| Reports CTA | Luo raportti | Skapa rapport | Low | Already present and safe. |
| Reports CTA | Vie PDF | Exportera PDF | Low | Already present and safe. |
| Report variant | Julkinen yhteenveto | Offentlig sammanfattning | Medium | Fine in list rows and preview; avoid forcing into narrow buttons. |
| Report variant | Luottamuksellinen liite | Konfidentiell bilaga | Medium | Fine as a row title; avoid all-caps or tight badges. |

## Highest-pressure strings

| Surface | Finnish | Current / proposed Swedish | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| Step title | Tarkista mitkä vuodet kannattaa tuoda | Granska vilka år som är värda att importera | High | Keep the long string in the page title only, not inside the top tracker. |
| Step title | Luo suunnittelupohja | Skapa planeringsunderlag | Medium | Fine as a page heading; do not compress into a narrow button. |
| Review CTA | Tallenna ja hyväksy | Spara och godkänn | Medium | Keep button min-width flexible; do not assume one-line fit on smaller widths. |
| Include control | Mukana / Ei mukana | Ingår / Ingår inte | Medium | Better than a long action verb. Works well as a segmented control. |
| Include action | Poista valinnasta | Ta bort från valet | High | Avoid as a persistent wide button if the segmented include control already handles state. |
| Forecast CTA | Avaa Poistosuunnitelmat | Öppna avskrivningsplaner | High | Too long for a dense operator board. Keep the card title as the object name and shorten the CTA to `Öppna`. |
| Reports CTA | Avaa Ennuste | Öppna Prognos | Low | Current repo label is safe. |

## Current repo truths to preserve

- `wizardQuestionConnect`: `Välj vattenverk`
- `wizardQuestionImportYears`: `Granska vilka år som är värda att importera`
- `wizardQuestionReviewYears`: `Granska importerade år`
- `wizardQuestionBaseline`: `Skapa planeringsunderlaget`
- `wizardQuestionForecast`: `Fortsätt till Prognos`
- `openForecast`: `Öppna Prognos`
- `variantPublic`: `Offentlig sammanfattning`
- `variantConfidential`: `Konfidentiell bilaga`
- `createReport`: `Skapa rapport`
- `exportPdf`: `Exportera PDF`
- `depreciationRulesTitle`: `Avskrivningsplaner`
- `statementImportConfirmAndSync`: `Bekräfta import och synkronisera år`
- `manualPatchSaveAndSync`: `Spara och synkronisera år`
- `applyVeetiValues`: `Återställ VEETI-värden`

## Practical UI rules for the implementation pass

1. Keep short tracker labels in all languages; put the full wording in the section heading.
2. Treat `Mukana / Ei mukana` as the main include control; drop the extra long removal CTA where possible.
3. Do not use `Öppna avskrivningsplaner` as a dense card button label. Use `Öppna` and keep the object name in the card title.
4. Give primary buttons room to wrap only as a last resort; prefer flexible width and stable padding first.
5. Re-check Swedish in the rendered app after implementation, especially the step bar, review footer, and forecast workbench entry.
