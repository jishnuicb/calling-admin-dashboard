import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Settings } from 'lucide-react';
import { appSettingsApi, configApi } from '../api/endpoints';
import { qk } from '../api/queryKeys';
import { useApiMutation } from '../hooks/useApiMutation';
import { useAuth } from '../auth/AuthContext';
import { P } from '../auth/permissions';
import {
  Badge,
  Button,
  Card,
  ErrorState,
  Field,
  Input,
  LoadingBlock,
  Modal,
  PageHeader,
  Select,
  Toggle,
} from '../components/ui';

/**
 * Human-readable context for each runtime setting.
 *
 * The API returns keys, values and types; it does not explain consequences. These
 * notes do, because several of these keys change money or call behaviour the
 * moment they are saved — `call.ratePerSecond` in particular only affects calls
 * started afterwards, since each call snapshots the rate at initiate.
 */
const CONFIG_META = {
  'call.ratePerSecond': {
    label: 'Call rate',
    unit: 'tokens per second',
    note: 'Decimals allowed (e.g. 2.25). Wallet still charges whole tokens: floor(seconds × rate). Snapshotted at initiate — does not re-price in-progress calls.',
    group: 'Calling',
  },
  'call.ringTimeoutSeconds': {
    label: 'Ring timeout',
    unit: 'seconds',
    note: 'How long a call rings before it is marked missed. The sweep enforces this even if both clients disconnect.',
    group: 'Calling',
  },
  'call.minBalanceToStart': {
    label: 'Minimum balance to start a call',
    unit: 'tokens',
    note: 'Callers below this cannot initiate. Prevents a call that would end almost immediately.',
    group: 'Calling',
  },
  'agora.packageMinutes': {
    label: 'Agora monthly package minutes',
    unit: 'minutes',
    note: 'Your Agora Console subscription package size for the current UTC month. Dashboard usage bar ≈ (talk seconds × 2 participants / 60) of this package. Set 0 to hide the bar.',
    group: 'Calling',
  },
  'call.peakRate.caller.ratePerSecond': {
    label: 'Caller peak rate',
    unit: 'tokens per second',
    note: 'Decimals allowed (e.g. 2.25). Auto-applied every day 12:00 AM–6:00 AM IST for NEW calls (window hardcoded). In-progress calls keep the rate snapshotted at initiate.',
    group: 'Peak rates (IST 12AM–6AM)',
  },
  'call.peakRate.listener.earnPaisePerSecond': {
    label: 'Listener peak earn rate',
    unit: 'paise per second',
    note: 'Auto-applied every day 12:00 AM–6:00 AM IST for NEW calls (window hardcoded). Decimals allowed (e.g. 4.45).',
    group: 'Peak rates (IST 12AM–6AM)',
  },
  'listener.earnPaisePerSecond': {
    label: 'Listener earn rate',
    unit: 'paise per second',
    note: 'INR credited to the listener per second of talk time (100 paise = ₹1). Supports decimals (e.g. 6.66). Snapshotted onto each call at initiate. Amount = round(seconds × rate) in whole paise. Does not change caller token billing.',
    group: 'Listener payouts',
  },
  'payout.schedule': {
    label: 'Automatic payout schedule',
    note: 'OFF, WEEKLY, or MONTHLY. Cron creates Cashfree transfers for listeners above the minimum. Manual payouts always work from the Payouts page.',
    group: 'Listener payouts',
  },
  'payout.minAmountPaise': {
    label: 'Minimum automatic payout',
    unit: 'paise',
    note: 'Listeners below this pending balance are skipped by weekly/monthly runs. Manual payouts ignore this floor.',
    group: 'Listener payouts',
  },
  'presence.offlineGraceSeconds': {
    label: 'Presence offline grace (unused)',
    unit: 'seconds',
    note: 'Legacy setting. Online/offline is manual-only now — socket disconnect no longer flips listeners offline.',
    group: 'Calling',
  },
  'otp.resendDelayAfterFirstSeconds': {
    label: 'OTP resend wait after the 1st request',
    unit: 'seconds',
    note: 'First /otp/send is immediate; wait before another preflight (MSG91 widget sends the SMS). Also editable from OTP & lockouts.',
    group: 'OTP & verification',
  },
  'otp.resendDelayAfterSecondSeconds': {
    label: 'OTP resend wait after the 2nd request',
    unit: 'seconds',
    note: 'Applies to the third request and any beyond it, so raising the attempt limit still throttles.',
    group: 'OTP & verification',
  },
  'otp.maxRequestsBeforeLock': {
    label: 'OTP requests before lock',
    unit: 'requests',
    note: 'Once this many /otp/send preflights succeed the number is locked. An admin can unlock it under OTP & lockouts; a successful widget verify also clears the lock and the counter.',
    group: 'OTP & verification',
  },
  'otp.backup.expirySeconds': {
    label: 'Backup OTP expiry',
    unit: 'seconds',
    note: 'How long the support backup OTP (issued on send or by admin) remains valid. Default 300 (5 minutes). Range 60–3600.',
    group: 'OTP & verification',
  },
  'otp.whatsapp.deliveryMode': {
    label: 'WhatsApp OTP delivery mode',
    note: 'WHATSAPP_1 / WHATSAPP_2 use the matching MSG91 from-number + template from server env. FORCE_SMS sends SMS when the app asks for WhatsApp (same user-facing success shape). Also editable on OTP & lockouts.',
    group: 'OTP & verification',
  },
  'chat.enabled': {
    label: 'In-app chat enabled',
    note: 'Master switch. When off, apps hide chat and APIs reject open/send. Default off — no impact on current users.',
    group: 'In-app chat',
  },
  'chat.minCallDurationSeconds': {
    label: 'Min call duration to unlock chat',
    unit: 'seconds',
    note: 'Call must reach at least this billed duration before chat is offered from history. Default 1.',
    group: 'In-app chat',
  },
  'chat.expiryHours': {
    label: 'Chat session expiry',
    unit: 'hours',
    note: 'After this, Firebase session messages are purged and clients see an empty new session on re-open. Default 24.',
    group: 'In-app chat',
  },
  'chat.blockUrls': {
    label: 'Block URLs in chat',
    note: 'When true, messages containing links are rejected.',
    group: 'In-app chat',
  },
  'chat.partnerOpenCooldownMinutes': {
    label: 'Cooldown before opening another partner',
    unit: 'minutes',
    note: 'After opening chat with one partner, wait this long before opening a different partner. 0 = no cooldown.',
    group: 'In-app chat',
  },
  'chat.caller.maxMessageLength': {
    label: 'Caller max message length',
    unit: 'characters',
    note: 'Default 40.',
    group: 'In-app chat',
  },
  'chat.caller.maxMessagesPerHour': {
    label: 'Caller messages per hour',
    note: 'Default 5.',
    group: 'In-app chat',
  },
  'chat.caller.maxMessagesPerDay': {
    label: 'Caller messages per day',
    note: 'Default 20.',
    group: 'In-app chat',
  },
  'chat.caller.maxPartnersPerDay': {
    label: 'Caller max chat partners per day',
    note: 'Default 5.',
    group: 'In-app chat',
  },
  'chat.host.maxMessageLength': {
    label: 'Host max message length',
    unit: 'characters',
    note: 'Default 40.',
    group: 'In-app chat',
  },
  'chat.host.maxMessagesPerHour': {
    label: 'Host messages per hour',
    note: 'Default 5.',
    group: 'In-app chat',
  },
  'chat.host.maxMessagesPerDay': {
    label: 'Host messages per day',
    note: 'Default 20.',
    group: 'In-app chat',
  },
  'chat.host.maxPartnersPerDay': {
    label: 'Host max chat partners per day',
    note: 'Default 20.',
    group: 'In-app chat',
  },
  'discovery.defaultLanguage': {
    label: 'Default discovery language',
    note: 'Applied when a caller browses listeners without choosing a language. Must match a language name in the master list, or no default is applied.',
    group: 'Discovery',
  },
  'fakeListeners.enabled': {
    label: 'Always-busy decoy listeners enabled',
    note: 'When on, up to maxActive marked decoys stay in the caller list as busy. Managed on the Fake listeners page.',
    group: 'Discovery',
  },
  'fakeListeners.maxActive': {
    label: 'Decoy listeners in list (max)',
    note: 'How many marked decoys are forced online+busy at once (e.g. 3). Raise or lower anytime; extras stay marked but offline.',
    group: 'Discovery',
  },
  'fakeListeners.pulseEverySeconds': {
    label: 'Decoy free-pulse interval',
    unit: 'seconds',
    note: 'How often one decoy briefly shows as free (1–2 seconds) then busy again. Only one at a time.',
    group: 'Discovery',
  },
  'fakeListeners.rotateEveryMinutes': {
    label: 'Decoy identity rotate interval',
    unit: 'minutes',
    note: 'How often one random decoy leaves the list, then returns with a different name+bio+photo combo. Default 10.',
    group: 'Discovery',
  },
  'fakeListeners.rotateOfflineSeconds': {
    label: 'Decoy rotate offline duration',
    unit: 'seconds',
    note: 'How long that decoy stays out of the list before coming back with a new identity. Default 60.',
    group: 'Discovery',
  },
  'cardGuess.enabled': {
    label: 'Card Guess mini-game enabled',
    note: 'When off, all Card Guess APIs/sockets return disabled and calls are completely unaffected. Off by default.',
    group: 'Card Guess',
  },
  'cardGuess.deck': {
    label: 'Card deck',
    note: 'JSON array of card labels used when dealing a round. Example: ["A","2","3","4","5","6","7","8","9","10","J","Q","K"].',
    group: 'Card Guess',
  },
  'cardGuess.cardsPerRound': {
    label: 'Cards per round',
    note: 'How many cards are dealt each round (default 3). Min 1, max 13 (capped by deck size).',
    group: 'Card Guess',
  },
  'cardGuess.score.correct3': {
    label: 'Points for 3 correct positions',
    note: 'Awarded to the call’s listener when the guesser gets all positions right. Default 10.',
    group: 'Card Guess',
  },
  'cardGuess.score.correct2': {
    label: 'Points for 2 correct positions',
    note: 'Default 5.',
    group: 'Card Guess',
  },
  'cardGuess.score.correct1': {
    label: 'Points for 1 correct position',
    note: 'Default 1.',
    group: 'Card Guess',
  },
  'cardGuess.score.correct0': {
    label: 'Points for 0 correct positions',
    note: 'Default 0.',
    group: 'Card Guess',
  },
  'cardGuess.pairCooldownMinutes': {
    label: 'Pair cooldown',
    unit: 'minutes',
    note: 'After a completed round, the same listener+caller pair must wait this long before starting again. Other partners are unaffected. Default 10. Set 0 to disable.',
    group: 'Card Guess',
  },
  'cardGuess.starterShuffleAllowed': {
    label: 'Allow starter shuffle',
    note: 'When on, the starter may shuffle the dealt cards before locking the pattern. Default on.',
    group: 'Card Guess',
  },
  'payment.firstPaymentBonus.enabled': {
    label: 'First-payment bonus (global) enabled',
    note: 'When ON, ignores per-package “first payment bonus tokens” and uses FIXED or PERCENTAGE rules below. When OFF, legacy per-package first-payment tokens still apply.',
    group: 'First payment bonus',
  },
  'payment.firstPaymentBonus.mode': {
    label: 'First-payment bonus mode',
    note: 'FIXED = flat extra tokens. PERCENTAGE = floor(package tokens × percent / 100). Only one mode is active.',
    group: 'First payment bonus',
  },
  'payment.firstPaymentBonus.fixedTokens': {
    label: 'Fixed extra tokens',
    unit: 'tokens',
    note: 'Used when mode is FIXED. Example: 50 → +50 tokens on first eligible purchase.',
    group: 'First payment bonus',
  },
  'payment.firstPaymentBonus.percent': {
    label: 'Percentage extra',
    unit: '% of package tokens',
    note: 'Used when mode is PERCENTAGE. Example: 5 with a 700-token pack → floor(700×5/100)=35 extra tokens.',
    group: 'First payment bonus',
  },
  'payment.firstPaymentBonus.minPurchaseAmount': {
    label: 'Minimum purchase amount',
    unit: 'price (package currency)',
    note: 'First-payment bonus applies only when package price ≥ this amount. 0 = no minimum.',
    group: 'First payment bonus',
  },
  'payment.firstPaymentBonus.title': {
    label: 'Promo title / label',
    note: 'Shown to the app (e.g. “First time purchase, earn 25% extra token for calls”). Returned as title and label on settings.',
    group: 'First payment bonus',
  },
  'bonus.welcome.enabled': {
    label: 'Welcome bonus enabled',
    note: 'Grants tokens once per user on first verification. Idempotent, so it cannot be claimed twice.',
    group: 'Bonuses',
  },
  'bonus.welcome.tokens': {
    label: 'Welcome bonus amount',
    unit: 'tokens',
    note: 'Applies to users who verify after the change; already-granted bonuses are untouched.',
    group: 'Bonuses',
  },
  'bonus.welcome.socialEnabled': {
    label: 'Welcome bonus for Google / Apple',
    note:
      'When on (and welcome bonus enabled), Google/Apple sign-in users get the welcome bonus once per identity. Off by default. Delete + re-signup cannot claim again.',
    group: 'Bonuses',
  },
  'bonus.welcome.socialTokens': {
    label: 'Welcome bonus amount (Google / Apple)',
    unit: 'tokens',
    note:
      'Token amount for Google/Apple welcome bonus only. Independent of mobile OTP welcome amount (bonus.welcome.tokens). Default 50.',
    group: 'Bonuses',
  },
  'bonus.weekly.enabled': {
    label: 'User weekly bonus enabled',
    note: 'Caller talk-time weekly bonus. Prefer Bonuses → Weekly settings for edits.',
    group: 'Bonuses',
  },
  'bonus.weekly.targetMinutes': {
    label: 'User weekly target',
    unit: 'minutes',
    note: 'Talk time a caller must reach in the period to qualify.',
    group: 'Bonuses',
  },
  'bonus.weekly.rewardTokens': {
    label: 'User weekly reward',
    unit: 'tokens',
    note: 'Granted to each qualifying caller when the run completes.',
    group: 'Bonuses',
  },
  'bonus.weekly.listener.enabled': {
    label: 'Listener weekly bonus enabled',
    note: 'Listener talk-time weekly bonus (separate from users).',
    group: 'Bonuses',
  },
  'bonus.weekly.listener.targetMinutes': {
    label: 'Listener weekly target',
    unit: 'minutes',
    note: 'Talk time a listener must reach in the period to qualify.',
    group: 'Bonuses',
  },
  'bonus.weekly.listener.rewardTokens': {
    label: 'Listener weekly reward',
    unit: 'tokens',
    note: 'Granted to each qualifying listener when the run completes.',
    group: 'Bonuses',
  },
  'bulk.topup.enabled': {
    label: 'Daily bulk wallet top-up enabled',
    note: 'When on, the 12:00 AM IST cron credits eligible ACTIVE users. Prefer Money → Bulk top-up.',
    group: 'Bonuses',
  },
  'bulk.topup.tokens': {
    label: 'Bulk top-up tokens per user',
    unit: 'tokens',
    note: 'Default amount for automatic and manual bulk runs (manual can override). Also the previous-day spend threshold when that gate is on.',
    group: 'Bonuses',
  },
  'bulk.topup.excludeListeners': {
    label: 'Bulk top-up exclude listeners',
    note: 'When on, approved listeners never receive automatic or manual bulk top-up tokens.',
    group: 'Bonuses',
  },
  'bulk.topup.requirePreviousDaySpend': {
    label: 'Bulk top-up require previous-day spend',
    note: 'Automatic only: credit only if CALL_DEDUCTION spend on the previous calendar day (job timezone) is ≥ tokens per user. Manual runs ignore this.',
    group: 'Bonuses',
  },
  'demand.notify.enabled': {
    label: 'Demand notify enabled',
    note: 'When on, the background job can push offline callers/listeners when supply/demand is imbalanced. Turn off to pause all demand pushes without redeploying.',
    group: 'Demand notify',
  },
  'demand.notify.intervalMs': {
    label: 'Demand notify interval',
    unit: 'milliseconds',
    note: 'How often the job checks counts and may send pushes. Default 120000 (2 minutes). Min 30000, max 3600000. Changes apply within ~15 seconds — no server restart.',
    group: 'Demand notify',
  },
  'demand.notify.cooldownSeconds': {
    label: 'Per-user cooldown',
    unit: 'seconds',
    note: 'Same user will not get another demand push until this many seconds pass. Default 1800 (30 minutes).',
    group: 'Demand notify',
  },
  'demand.notify.batchSize': {
    label: 'Max recipients per tick',
    unit: 'users',
    note: 'Upper bound of offline users notified in one tick (random rotation among eligible). Default 25.',
    group: 'Demand notify',
  },
  'demand.notify.minListedForCallers': {
    label: 'Min listed listeners (exclusive) to notify callers',
    unit: 'listeners',
    note: 'Rule A: notify offline callers when listed listeners is greater than this AND free ratio is high enough. Default 4 (so need 5+ listed).',
    group: 'Demand notify',
  },
  'demand.notify.freeRatio': {
    label: 'Free-listener ratio to notify callers',
    unit: '0–1',
    note: 'Rule A: free / listed must be ≥ this (0.5 = 50% free). Busy listeners do not count as free.',
    group: 'Demand notify',
  },
  'demand.notify.minCallersForListeners': {
    label: 'Min online callers (exclusive) to notify listeners',
    unit: 'callers',
    note: 'Rule B: notify offline free listeners when discovery callers > this AND there are no free listed listeners. Default 2.',
    group: 'Demand notify',
  },
  'listener.notifyCaller.cooldownSeconds': {
    label: 'Notify-caller cooldown',
    unit: 'seconds',
    note: 'After a listener notifies any past caller from call history, they must wait this many seconds before notifying again (same or another user). Default 60 (1 minute). Min 10, max 3600.',
    group: 'Listener notify',
  },
  'listener.notifyCaller.maxPerCallerPerDay': {
    label: 'Max notifies to same caller / day',
    unit: 'per UTC day',
    note: 'How many times one listener may notify the same caller in one UTC calendar day. Default 5. Min 1, max 100.',
    group: 'Listener notify',
  },
  'listener.notifyCaller.maxPerListenerPerDay': {
    label: 'Max notifies from listener / day',
    unit: 'per UTC day',
    note: 'Total notify-caller pushes one listener may send to any callers in one UTC calendar day. Default 10. Min 1, max 500.',
    group: 'Listener notify',
  },
  'listener.knownLanguageCalls.cooldownMinutes': {
    label: 'Known-language calls toggle cooldown',
    unit: 'minutes',
    note: 'After a host turns “known language calls only” on or off, they must wait this many minutes before toggling again. Default 10. Set 0 to disable the cooldown. Max 1440 (24h).',
    group: 'Listener host',
  },
  'listener.onlinePing.enabled': {
    label: 'Listener online ping enabled',
    note: 'Hybrid: socket-connected online listeners use continuous websocket time (no FCM). Online + no socket get FCM pings; ACK credits min(interval, time since last credited end). Missed ACKs credit nothing.',
    group: 'Listener online ping',
  },
  'listener.onlinePing.intervalMs': {
    label: 'Online ping interval',
    unit: 'milliseconds',
    note: 'Ping cadence for online listeners with no socket, and max seconds credited per ACK (default 1800000 = 30 min). If the gap since last credited time is smaller, only that difference is added. Socket-connected listeners are skipped.',
    group: 'Listener online ping',
  },
  'listener.onlinePing.ackTimeoutMs': {
    label: 'Online ping ACK timeout',
    unit: 'milliseconds',
    note: 'How long a no-socket online listener has to POST /listener/online-ack before the chunk is forfeited. Default 300000 (5 min). Min 5000, max 600000.',
    group: 'Listener online ping',
  },
  'listener.missedCalls.autoOfflineEnabled': {
    label: 'Auto-offline after consecutive missed calls',
    note: 'When on, an online listener who gets consecutive MISSED (no-answer) calls with no other call outcome in between is set offline and must go online manually. Logged in Audit as listener.auto_offline_missed_calls.',
    group: 'Listener presence',
  },
  'listener.missedCalls.autoOfflineThreshold': {
    label: 'Consecutive missed calls before offline',
    note: 'Number of adjacent MISSED calls required (default 2). Minimum 2. Time between misses does not matter — only that no answered/rejected/cancelled/ended call sits between them.',
    group: 'Listener presence',
  },
  'security.ipBlock.enabled': {
    label: 'IP block enabled',
    note: 'When on, IPs that exceed rate/OTP limits are auto-blocked (and manual blocks apply). Blocked IPs get 403 IP_BLOCKED on API and socket.',
    group: 'IP security',
  },
  'security.ipBlock.rateWindowMs': {
    label: 'IP request window',
    unit: 'milliseconds',
    note: 'Window for counting non-admin API requests per IP. Default 60000 (1 min).',
    group: 'IP security',
  },
  'security.ipBlock.rateMax': {
    label: 'IP request max',
    note: 'Max non-admin API requests per IP in the window before auto RATE_LIMIT block. Default 120.',
    group: 'IP security',
  },
  'security.ipBlock.otpMax': {
    label: 'OTP sends per IP max',
    note: 'Max OTP send attempts from one IP (any mobile numbers) in the OTP window before OTP_ABUSE block. Default 15.',
    group: 'IP security',
  },
  'security.ipBlock.otpUniqueMobilesMax': {
    label: 'OTP unique mobiles per IP',
    note: 'Max distinct phone numbers an IP may OTP in the window before OTP_SPRAY block. Default 5.',
    group: 'IP security',
  },
  'security.ipBlock.otpWindowMs': {
    label: 'OTP IP window',
    unit: 'milliseconds',
    note: 'Window for OTP-per-IP and unique-mobile counting. Default 900000 (15 min).',
    group: 'IP security',
  },
  'security.ipBlock.banTtlSeconds': {
    label: 'Auto-ban duration',
    unit: 'seconds',
    note: 'How long auto-blocks last (0 = until admin unblocks). Default 3600 (1 hour). Manual blocks default to until unblock.',
    group: 'IP security',
  },
  'security.otpHoneypot.ips': {
    label: 'OTP send honeypot IPs',
    note: 'Comma/newline-separated real client IPs that get a fake OTP-send 200 (no MSG91). Auto-add may append here.',
    group: 'IP security',
  },
  'security.otpHoneypot.autoAddEnabled': {
    label: 'Auto-add SMS burst IPs to honeypot',
    note: 'When on, an IP that hits the SMS OTP send threshold in the window is appended to the honeypot list.',
    group: 'IP security',
  },
  'security.otpHoneypot.autoAddMaxSmsSends': {
    label: 'SMS OTP sends before auto-honeypot',
    unit: 'sends',
    note: 'Successful SMS OTP sends from the same IP (not WhatsApp). Default 3.',
    group: 'IP security',
  },
  'security.otpHoneypot.autoAddWindowSeconds': {
    label: 'SMS burst window',
    unit: 'seconds',
    note: 'Rolling window for counting SMS OTP sends toward auto-honeypot. Default 180 (3 minutes).',
    group: 'IP security',
  },
  'security.googleSignup.enabled': {
    label: 'Google signup IP limit',
    note: 'When on, limit how many new Google accounts one IP can create in a window. Returning Google logins stay allowed. Locks appear on Blocked IPs with reason GOOGLE_SIGNUP.',
    group: 'IP security',
  },
  'security.googleSignup.maxAccountsPerWindow': {
    label: 'Google accounts per IP (max)',
    note: 'Max new Google accounts from one IP inside the window. Default 2.',
    group: 'IP security',
  },
  'security.googleSignup.windowMs': {
    label: 'Google signup window',
    unit: 'milliseconds',
    note: 'Window for counting new Google accounts per IP. Default 900000 (15 min).',
    group: 'IP security',
  },
  'security.googleSignup.lockTtlSeconds': {
    label: 'Google signup lock duration',
    unit: 'seconds',
    note: 'After hitting the max, how long further new Google accounts from that IP are blocked. Default 86400 (24h).',
    group: 'IP security',
  },
};

/** Edited in the dedicated App & support card — hide from the generic list. */
const APP_SETTINGS_KEYS = new Set([
  'app.version.major',
  'app.version.minor',
  'app.version.patch',
  'app.releaseType',
  'app.ios.version.major',
  'app.ios.version.minor',
  'app.ios.version.patch',
  'app.ios.releaseType',
  'company.whatsappNumber',
  'company.supportEmail',
  'payment.mode',
  'app.reviewReminder.enabled',
  'app.reviewReminder.intervalMinutes',
  'app.maintenance.enabled',
  'app.maintenance.startAt',
  'app.maintenance.endAt',
]);

function AppSettingsCard({ writable }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.appSettings,
    queryFn: () => appSettingsApi.get(),
  });

  const [major, setMajor] = useState(1);
  const [minor, setMinor] = useState(0);
  const [patch, setPatch] = useState(0);
  const [releaseType, setReleaseType] = useState('MINOR');
  const [iosMajor, setIosMajor] = useState(1);
  const [iosMinor, setIosMinor] = useState(0);
  const [iosPatch, setIosPatch] = useState(0);
  const [iosReleaseType, setIosReleaseType] = useState('MINOR');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [paymentMode, setPaymentMode] = useState('SANDBOX');
  const [reviewReminderEnabled, setReviewReminderEnabled] = useState(false);
  const [reviewReminderIntervalMinutes, setReviewReminderIntervalMinutes] = useState(10080);
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [maintenanceStartAt, setMaintenanceStartAt] = useState('');
  const [maintenanceEndAt, setMaintenanceEndAt] = useState('');

  useEffect(() => {
    if (!data) return;
    setMajor(data.version?.major ?? 1);
    setMinor(data.version?.minor ?? 0);
    setPatch(data.version?.patch ?? 0);
    setReleaseType(data.version?.releaseType || 'MINOR');
    setIosMajor(data.iosVersion?.major ?? data.version?.major ?? 1);
    setIosMinor(data.iosVersion?.minor ?? data.version?.minor ?? 0);
    setIosPatch(data.iosVersion?.patch ?? data.version?.patch ?? 0);
    setIosReleaseType(data.iosVersion?.releaseType || data.version?.releaseType || 'MINOR');
    setWhatsappNumber(data.whatsappNumber || '');
    setSupportEmail(data.supportEmail || '');
    setPaymentMode(data.payment?.mode || 'SANDBOX');
    setReviewReminderEnabled(Boolean(data.reviewReminder?.enabled));
    setReviewReminderIntervalMinutes(data.reviewReminder?.intervalMinutes ?? 10080);
    setMaintenanceEnabled(Boolean(data.maintenance?.enabled));
    setMaintenanceStartAt(data.maintenance?.startAtLocal || '');
    setMaintenanceEndAt(data.maintenance?.endAtLocal || '');
  }, [data]);

  const mutation = useApiMutation({
    mutationFn: () =>
      appSettingsApi.update({
        major: Number(major),
        minor: Number(minor),
        patch: Number(patch),
        releaseType,
        iosMajor: Number(iosMajor),
        iosMinor: Number(iosMinor),
        iosPatch: Number(iosPatch),
        iosReleaseType,
        whatsappNumber: whatsappNumber.trim(),
        supportEmail: supportEmail.trim(),
        paymentMode,
        reviewReminderEnabled,
        reviewReminderIntervalMinutes: Number(reviewReminderIntervalMinutes),
        maintenanceEnabled,
        maintenanceStartAt: maintenanceStartAt.trim(),
        maintenanceEndAt: maintenanceEndAt.trim(),
      }),
    successMessage: 'App settings saved',
    invalidate: [qk.appSettings, qk.config],
  });

  if (isLoading) return <LoadingBlock label="Loading app settings…" />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const label = `${Number(major) || 0}.${Number(minor) || 0}.${Number(patch) || 0}`;
  const iosLabel = `${Number(iosMajor) || 0}.${Number(iosMinor) || 0}.${Number(iosPatch) || 0}`;
  const dirty =
    Number(major) !== (data.version?.major ?? 1) ||
    Number(minor) !== (data.version?.minor ?? 0) ||
    Number(patch) !== (data.version?.patch ?? 0) ||
    releaseType !== (data.version?.releaseType || 'MINOR') ||
    Number(iosMajor) !== (data.iosVersion?.major ?? data.version?.major ?? 1) ||
    Number(iosMinor) !== (data.iosVersion?.minor ?? data.version?.minor ?? 0) ||
    Number(iosPatch) !== (data.iosVersion?.patch ?? data.version?.patch ?? 0) ||
    iosReleaseType !== (data.iosVersion?.releaseType || data.version?.releaseType || 'MINOR') ||
    whatsappNumber.trim() !== (data.whatsappNumber || '') ||
    supportEmail.trim() !== (data.supportEmail || '') ||
    paymentMode !== (data.payment?.mode || 'SANDBOX') ||
    reviewReminderEnabled !== Boolean(data.reviewReminder?.enabled) ||
    Number(reviewReminderIntervalMinutes) !== (data.reviewReminder?.intervalMinutes ?? 10080) ||
    maintenanceEnabled !== Boolean(data.maintenance?.enabled) ||
    maintenanceStartAt.trim() !== (data.maintenance?.startAtLocal || '') ||
    maintenanceEndAt.trim() !== (data.maintenance?.endAtLocal || '');

  return (
    <Card
      title="App version, support contact & payments"
      description="Shown to the mobile app via GET /app/settings. Edit without a redeploy."
      actions={
        writable ? (
          <Button onClick={() => mutation.mutate()} loading={mutation.isPending} disabled={!dirty}>
            Save app settings
          </Button>
        ) : null
      }
    >
      <div className="space-y-5">
        {mutation.error && <ErrorState error={mutation.error} compact />}

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500">
            Android / legacy app release
          </p>
          <p className="mb-2 text-xs text-ink-500">
            Returned as <code className="rounded bg-ink-100 px-1">version</code> on GET /app/settings
            (existing apps keep using this).
          </p>
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="Major" required>
              <Input
                type="number"
                min={0}
                step={1}
                value={major}
                disabled={!writable}
                onChange={(e) => setMajor(e.target.value)}
              />
            </Field>
            <Field label="Minor" required>
              <Input
                type="number"
                min={0}
                step={1}
                value={minor}
                disabled={!writable}
                onChange={(e) => setMinor(e.target.value)}
              />
            </Field>
            <Field label="Patch" required>
              <Input
                type="number"
                min={0}
                step={1}
                value={patch}
                disabled={!writable}
                onChange={(e) => setPatch(e.target.value)}
              />
            </Field>
            <Field label="Release type" required>
              <Select
                value={releaseType}
                disabled={!writable}
                onChange={(e) => setReleaseType(e.target.value)}
              >
                <option value="MAJOR">MAJOR</option>
                <option value="MINOR">MINOR</option>
                <option value="PATCH">PATCH</option>
              </Select>
            </Field>
          </div>
          <p className="mt-2 text-xs text-ink-500">
            Current label: <span className="font-medium tabular text-ink-800">{label}</span>
            {data.version?.label && data.version.label !== label ? (
              <span className="text-ink-400"> (saved as {data.version.label})</span>
            ) : null}
          </p>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500">
            iOS app release
          </p>
          <p className="mb-2 text-xs text-ink-500">
            Returned as additive <code className="rounded bg-ink-100 px-1">iosVersion</code> on GET
            /app/settings. Does not change <code className="rounded bg-ink-100 px-1">version</code>.
          </p>
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="Major" required>
              <Input
                type="number"
                min={0}
                step={1}
                value={iosMajor}
                disabled={!writable}
                onChange={(e) => setIosMajor(e.target.value)}
              />
            </Field>
            <Field label="Minor" required>
              <Input
                type="number"
                min={0}
                step={1}
                value={iosMinor}
                disabled={!writable}
                onChange={(e) => setIosMinor(e.target.value)}
              />
            </Field>
            <Field label="Patch" required>
              <Input
                type="number"
                min={0}
                step={1}
                value={iosPatch}
                disabled={!writable}
                onChange={(e) => setIosPatch(e.target.value)}
              />
            </Field>
            <Field label="Release type" required>
              <Select
                value={iosReleaseType}
                disabled={!writable}
                onChange={(e) => setIosReleaseType(e.target.value)}
              >
                <option value="MAJOR">MAJOR</option>
                <option value="MINOR">MINOR</option>
                <option value="PATCH">PATCH</option>
              </Select>
            </Field>
          </div>
          <p className="mt-2 text-xs text-ink-500">
            Current label: <span className="font-medium tabular text-ink-800">{iosLabel}</span>
            {data.iosVersion?.label && data.iosVersion.label !== iosLabel ? (
              <span className="text-ink-400"> (saved as {data.iosVersion.label})</span>
            ) : null}
          </p>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500">
            Support contact
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="WhatsApp number"
              hint="Include country code. Flutter opens wa.me from this value."
            >
              <Input
                type="tel"
                placeholder="+91 98765 43210"
                value={whatsappNumber}
                disabled={!writable}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                maxLength={32}
              />
            </Field>
            <Field
              label="Support email"
              hint="Shown when OTP is locked (OTP_LOCKED) and on GET /app/settings."
            >
              <Input
                type="email"
                placeholder="support@example.com"
                value={supportEmail}
                disabled={!writable}
                onChange={(e) => setSupportEmail(e.target.value)}
                maxLength={200}
              />
            </Field>
          </div>
          {data.whatsappLink && (
            <p className="mt-2 text-xs text-ink-500">
              WhatsApp link:{' '}
              <a
                className="font-medium text-brand-700 underline"
                href={data.whatsappLink}
                target="_blank"
                rel="noreferrer"
              >
                {data.whatsappLink}
              </a>
            </p>
          )}
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500">
            Payment settings
          </p>
          <Field
            label="Payment mode"
            required
            hint="SANDBOX for test payments, LIVE for production. Default is SANDBOX."
          >
            <Select
              value={paymentMode}
              disabled={!writable}
              onChange={(e) => setPaymentMode(e.target.value)}
            >
              <option value="SANDBOX">SANDBOX</option>
              <option value="LIVE">LIVE</option>
            </Select>
          </Field>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500">
            Review reminder
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Show review reminder"
              hint="When on, the app may prompt users to leave a store review."
            >
              <Toggle
                checked={reviewReminderEnabled}
                disabled={!writable}
                onChange={setReviewReminderEnabled}
                label={reviewReminderEnabled ? 'Enabled' : 'Disabled'}
              />
            </Field>
            <Field
              label="Interval (minutes)"
              hint="Minimum minutes between review prompts (1–525600). Default 10080 (7 days)."
            >
              <Input
                type="number"
                min={1}
                max={525600}
                step={1}
                value={reviewReminderIntervalMinutes}
                disabled={!writable}
                onChange={(e) => setReviewReminderIntervalMinutes(e.target.value)}
              />
            </Field>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500">
            Maintenance
          </p>
          <p className="mb-2 text-xs text-ink-500">
            When active, app APIs return{' '}
            <code className="rounded bg-ink-100 px-1">503 MAINTENANCE</code>. Admin,{' '}
            <code className="rounded bg-ink-100 px-1">/app/settings</code>, and payment webhooks stay
            open. Optional from/to are IST wall clock.
            {data.maintenance?.active ? (
              <span className="ml-1 font-medium text-amber-700">Blocking is on now.</span>
            ) : null}
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Maintenance mode" hint="Blocks app APIs when active.">
              <Toggle
                checked={maintenanceEnabled}
                disabled={!writable}
                onChange={setMaintenanceEnabled}
                label={maintenanceEnabled ? 'Enabled' : 'Disabled'}
              />
            </Field>
            <Field label="From (IST)" hint="Date + time. Empty = unset.">
              <Input
                type="datetime-local"
                value={maintenanceStartAt}
                disabled={!writable}
                onChange={(e) => setMaintenanceStartAt(e.target.value)}
              />
            </Field>
            <Field label="To (IST)" hint="Date + time. Empty = unset.">
              <Input
                type="datetime-local"
                value={maintenanceEndAt}
                disabled={!writable}
                onChange={(e) => setMaintenanceEndAt(e.target.value)}
              />
            </Field>
          </div>
          {(data.maintenance?.startAt || data.maintenance?.endAt) && (
            <p className="mt-2 text-xs text-ink-500">
              Saved:{' '}
              <span className="font-medium tabular text-ink-800">
                {data.maintenance?.startAtLocal || '—'} → {data.maintenance?.endAtLocal || '—'}
              </span>
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

const DELIVERY_MODE_OPTIONS = [
  { value: 'WHATSAPP_1', label: 'WhatsApp slot 1 (env MSG91_WHATSAPP_*)' },
  { value: 'WHATSAPP_2', label: 'WhatsApp slot 2 (env MSG91_WHATSAPP_2_*)' },
  { value: 'FORCE_SMS', label: 'Force SMS (when app asks for WhatsApp)' },
];

function EditConfigModal({ entry, onClose }) {
  const isBoolean = typeof entry.value === 'boolean' || entry.type === 'boolean';
  // Some settings are genuinely textual (the default discovery language), so the
  // editor cannot assume a number - coercing one would save NaN.
  const isText = !isBoolean && (typeof entry.value === 'string' || entry.type === 'string');
  const isDeliveryMode = entry.key === 'otp.whatsapp.deliveryMode';
  const [value, setValue] = useState(entry.value);
  const [description, setDescription] = useState(entry.description || '');

  const coercedValue = () => {
    if (isBoolean) return Boolean(value);
    if (isText || isDeliveryMode) return String(value);
    return Number(value);
  };

  const mutation = useApiMutation({
    mutationFn: () =>
      configApi.set({
        key: entry.key,
        // The backend coerces to the type of the environment default, so sending
        // a numeric string is safe - but sending the right type is clearer.
        value: coercedValue(),
        description: description || undefined,
      }),
    successMessage: `${entry.key} updated`,
    invalidate: [qk.config],
    onSuccess: onClose,
  });

  const meta = CONFIG_META[entry.key] || {};
  const changed = String(value) !== String(entry.value);

  return (
    <Modal
      open
      onClose={onClose}
      title={meta.label || entry.key}
      description={entry.key}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
            disabled={!changed && !description}
          >
            Save setting
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {mutation.error && <ErrorState error={mutation.error} compact />}

        {isBoolean ? (
          <div className="rounded-lg bg-ink-50 px-3.5 py-3">
            <Toggle
              checked={Boolean(value)}
              onChange={setValue}
              label={Boolean(value) ? 'Enabled' : 'Disabled'}
            />
          </div>
        ) : isDeliveryMode ? (
          <Field label="Delivery mode" required>
            <Select autoFocus value={String(value)} onChange={(e) => setValue(e.target.value)}>
              {DELIVERY_MODE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <Field label="Value" required hint={meta.unit}>
            <Input
              autoFocus
              type={isText ? 'text' : 'number'}
              step={isText ? undefined : 'any'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </Field>
        )}

        {meta.note && (
          <p className="rounded-lg bg-brand-50 px-3.5 py-2.5 text-xs text-brand-900">{meta.note}</p>
        )}

        <Field label="Description" hint="Optional note stored alongside the value.">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>

        {changed && (
          <div className="rounded-lg bg-ink-50 px-3.5 py-2.5 text-sm">
            <span className="text-ink-500">Changing from </span>
            <span className="font-medium tabular text-ink-900">{String(entry.value)}</span>
            <span className="text-ink-500"> to </span>
            <span className="font-medium tabular text-ink-900">{String(value)}</span>
          </div>
        )}

        <p className="text-xs text-ink-500">
          Runtime settings are cached in-process for a few seconds, so a change can take a moment to
          be visible on every server instance.
        </p>
      </div>
    </Modal>
  );
}

export function ConfigPage() {
  const { can } = useAuth();
  const [editing, setEditing] = useState(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.config,
    queryFn: () => configApi.list(),
  });

  if (isLoading) return <LoadingBlock label="Loading configuration…" />;
  if (error) {
    return (
      <>
        <PageHeader title="Configuration" />
        <ErrorState error={error} onRetry={refetch} />
      </>
    );
  }

  const entries = (data?.data || data || []).filter((entry) => !APP_SETTINGS_KEYS.has(entry.key));
  const writable = can(P.CONFIG_WRITE);

  // Group by the meta table so related settings sit together.
  const groups = entries.reduce((acc, entry) => {
    const group = CONFIG_META[entry.key]?.group || 'Other';
    (acc[group] = acc[group] || []).push(entry);
    return acc;
  }, {});

  return (
    <>
      <PageHeader
        title="Configuration"
        description="Runtime settings, editable without a deployment. Environment variables provide the defaults; a value saved here overrides them."
      />

      {!writable && (
        <div className="mb-4 rounded-lg border border-ink-200 bg-white px-4 py-3 text-sm text-ink-600">
          You have read-only access to configuration.
        </div>
      )}

      <div className="mb-4">
        <AppSettingsCard writable={writable} />
      </div>

      <div className="space-y-4">
        {Object.entries(groups).map(([group, groupEntries]) => (
          <Card key={group} title={group} bodyClassName="divide-y divide-ink-100 px-2">
            {groupEntries.map((entry) => {
              const meta = CONFIG_META[entry.key] || {};
              const isBoolean = typeof entry.value === 'boolean';

              return (
                <div
                  key={entry.key}
                  className="flex flex-wrap items-start justify-between gap-4 px-2 py-3.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-ink-900">{meta.label || entry.key}</p>
                      <code className="rounded bg-ink-100 px-1.5 py-0.5 font-mono text-[11px] text-ink-600">
                        {entry.key}
                      </code>
                      {entry.isOverridden && <Badge tone="brand">overridden</Badge>}
                    </div>
                    <p className="mt-1 max-w-2xl text-xs text-ink-500">
                      {meta.note || entry.description}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <div className="text-right">
                      {isBoolean ? (
                        <Badge tone={entry.value ? 'success' : 'neutral'}>
                          {entry.value ? 'Enabled' : 'Disabled'}
                        </Badge>
                      ) : (
                        <>
                          <p className="text-lg font-semibold tabular text-ink-900">
                            {String(entry.value)}
                          </p>
                          {meta.unit && <p className="text-[11px] text-ink-500">{meta.unit}</p>}
                        </>
                      )}
                    </div>
                    {writable && (
                      <Button size="sm" variant="secondary" onClick={() => setEditing(entry)}>
                        Edit
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </Card>
        ))}

        {entries.length === 0 && (
          <Card>
            <div className="py-8 text-center">
              <Settings className="mx-auto mb-3 size-6 text-ink-400" />
              <p className="text-sm text-ink-600">
                No configuration rows found. Run the backend seed to install the defaults.
              </p>
            </div>
          </Card>
        )}
      </div>

      {editing && <EditConfigModal entry={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
