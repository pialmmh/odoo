# EspoCRM custom metadata — meeting integration

Drop-in metadata for the meeting feature (recording + shareable magic
links). These files must be copied to **the deployed EspoCRM install**
of every tenant that should support the feature.

## Files

Relative paths under `custom/Espo/Custom/Resources/` inside EspoCRM:

```
metadata/entityDefs/Meeting.json           # extends built-in Meeting with LK fields
metadata/entityDefs/MeetingRecording.json  # new custom entity
metadata/entityDefs/MeetingMagicLink.json  # new custom entity
metadata/scopes/MeetingRecording.json
metadata/scopes/MeetingMagicLink.json
i18n/en_US/Global.json                     # labels for new entities
```

The files in this directory mirror that layout.

## Deploy

For each tenant's EspoCRM container:

```bash
# From an EspoCRM install root (the container that serves the tenant's Host)
ESPO_CUSTOM=<espo-root>/custom/Espo/Custom/Resources
cp -r config/espocrm-custom/metadata/*  "$ESPO_CUSTOM/metadata/"
cp -r config/espocrm-custom/i18n/*      "$ESPO_CUSTOM/i18n/"

# Flush Espo caches + rebuild
php clear_cache.php
php rebuild.php
```

After rebuild, the new entities appear under Admin → Entity Manager, and
the three new fields (`roomName`, `recordingEnabled`, `allowSelfRegister`)
show up on the Meeting entity.

## Revert

Remove the files and rebuild:

```bash
rm "$ESPO_CUSTOM/metadata/entityDefs/MeetingRecording.json"
rm "$ESPO_CUSTOM/metadata/entityDefs/MeetingMagicLink.json"
rm "$ESPO_CUSTOM/metadata/scopes/MeetingRecording.json"
rm "$ESPO_CUSTOM/metadata/scopes/MeetingMagicLink.json"
# For Meeting.json, only strip the added fields — don't remove the whole file
# (it may hold other tenant customisations). Diff against this repo to see
# which keys to keep out.
rm "$ESPO_CUSTOM/i18n/en_US/Global.json"   # if only added these labels
php clear_cache.php
php rebuild.php
```

## Why these live in this repo

Keeping them versioned here lets us track schema evolution alongside the
Java / React changes that depend on them. Actual Espo installs remain
outside the monorepo; these files are the source-of-truth definition.
