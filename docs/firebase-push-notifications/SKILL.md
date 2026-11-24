---
name: node-red-firebase-push
description: Input JSON for a Node-RED Firebase Cloud Messaging (FCM) node. Covers the JSON to configure the node with a Firebase project and the JSON to send a push notification to one device or many devices (one rig signed in on many devices). Use when building, configuring or calling the Node-RED Firebase push node.
---

# Node-RED Firebase push node: input JSON

## 1. Configure the node

The node configuration is the Firebase **service account key**. Download it from Firebase console →
Project settings → Service accounts → Generate new private key. It is a secret: keep it in the
node's credentials or an environment variable, never in a flow export or in git.

```json
{
  "type": "service_account",
  "project_id": "pushnotification-6f823",
  "private_key_id": "<private key id>",
  "private_key": "-----BEGIN PRIVATE KEY-----\n<key>\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@pushnotification-6f823.iam.gserviceaccount.com",
  "client_id": "<client id>",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx%40pushnotification-6f823.iam.gserviceaccount.com"
}
```

| Field | Required | Meaning |
| ---- | ---- | ---- |
| `project_id` | Yes | Firebase project that the app's tokens belong to |
| `private_key` | Yes | Keep the `\n` line breaks as they are in the downloaded file |
| `client_email` | Yes | Service account that signs the requests |
| Other fields | Yes | Paste the downloaded file as it is |

## 2. Send a notification (`msg.payload`)

### 2.1 Message

One message goes to every token in `tokens`. Each device has its own token, so one rig signed in on
many devices sends all of their tokens. For one device, send an array with that one token.

```json
{
  "tokens": [
    "dXk3...:APA91b...(tablet)",
    "fQ9a...:APA91b...(phone 1)",
    "c7Lm...:APA91b...(phone 2)"
  ],
  "notification": {
    "title": "Alarm: Mud Pump 2",
    "body": "Check Power End 3 in MUDPUMP 2"
  },
  "data": {
    "alertID": "a1b2c3",
    "type": "alarm",
    "rig": "547",
    "mudpump": "2",
    "startTime": "1763452800000"
  },
  "webpush": {
    "headers": {
      "TTL": "3600",
      "Urgency": "high"
    },
    "notification": {
      "icon": "https://precision-app.prescientdevices.us/logo192.png",
      "badge": "https://precision-app.prescientdevices.us/logo192.png",
      "tag": "a1b2c3",
      "requireInteraction": true
    },
    "fcmOptions": {
      "link": "https://precision-app.prescientdevices.us/"
    }
  }
}
```

If the Rig has only one device:

```json
{
  "tokens": ["dXk3...:APA91b..."],
  "notification": {
    "title": "Alarm: Mud Pump 2",
    "body": "Check Power End 3 in MUDPUMP 2"
  },
  "data": {
    "alertID": "a1b2c3",
    "type": "alarm",
    "rig": "547",
    "mudpump": "2",
    "startTime": "1763452800000"
  },
  "webpush": {
    "headers": {
      "TTL": "3600",
      "Urgency": "high"
    },
    "notification": {
      "icon": "https://precision-app.prescientdevices.us/logo192.png",
      "badge": "https://precision-app.prescientdevices.us/logo192.png",
      "tag": "a1b2c3",
      "requireInteraction": true
    },
    "fcmOptions": {
      "link": "https://precision-app.prescientdevices.us/"
    }
  }
}
```

### 2.2 Fields

| Field | Required | Meaning and rules |
| ---- | ---- | ---- |
| `tokens` | Yes | Array of FCM tokens, one per device, made by the app in the browser. One token is an array with one entry. Firebase takes at most **500 per call**: the node sends larger lists in batches of 500 |
| `notification.title` | Yes | Title. Phones cut it at about 40 characters |
| `notification.body` | Yes | Text. Phones show about 2 lines |
| `data` | No | Extra values for the app. **Every value must be a string** (`"2"`, not `2`). Do not use the keys `from`, `notification`, `message_type`, or keys starting with `google.` or `gcm.` |
| `webpush.headers.TTL` | No | Seconds that Firebase keeps the message for an offline device. At most 2419200 (28 days). Use a short value for alarms |
| `webpush.headers.Urgency` | No | `very-low`, `low`, `normal` or `high` |
| `webpush.notification.icon` | No | HTTPS URL of the icon |
| `webpush.notification.badge` | No | HTTPS URL of the small monochrome icon (Android) |
| `webpush.notification.tag` | No | A new notification with the same tag replaces the old one instead of stacking. Use the alert id |
| `webpush.notification.requireInteraction` | No | `true` keeps it on screen until the user acts (desktop browsers) |
| `webpush.fcmOptions.link` | No | HTTPS page that opens when the user taps the notification |

The whole message (`notification` plus `data`) must be **4 KB or less**.
