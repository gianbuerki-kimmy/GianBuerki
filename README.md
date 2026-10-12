# Schlüsselbund

Eine responsive, deutschsprachige Passwort- und Rabattcode-App ohne externe Abhängigkeiten.

## Lokal starten

Den Inhalt des Ordners `dist` über einen lokalen Webserver ausliefern, zum Beispiel:

```bash
python3 -m http.server 4173 --directory dist
```

Danach `http://127.0.0.1:4173` im Browser öffnen.

## Sicherheit

- Alle Tresordaten werden vor dem Speichern mit AES-GCM verschlüsselt.
- Der Schlüssel wird mit PBKDF2-SHA-256 aus dem Master-Passwort abgeleitet.
- Das Master-Passwort wird nicht gespeichert.
- Die verschlüsselten Daten verbleiben im lokalen Browser-Speicher.
- Eine Content-Security-Policy blockiert externe Skripte und Netzwerkverbindungen.
- Der Tresor sperrt sich nach einer einstellbaren Zeit ohne Aktivität automatisch.
- Bei vergessenem Master-Passwort kann der lokale Tresor nach Eingabe von `ZURÜCKSETZEN` vollständig gelöscht und neu eingerichtet werden.

Wichtig: Ohne das Master-Passwort können die bestehenden Daten nicht wiederhergestellt werden. Das Zurücksetzen löscht alle gespeicherten Einträge unwiderruflich. Browserdaten sollten nicht gelöscht werden, solange noch Einträge benötigt werden.
