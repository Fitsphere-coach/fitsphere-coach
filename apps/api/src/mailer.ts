// The approval email (ADR-0005): gym details and the approval code, sent through Gmail with an app
// password to FitSphere's approval inbox. A 10-second timeout and no automatic retry (a second send
// would be a second request). The password is never logged and never in an error message.
import nodemailer from 'nodemailer';
import type { Settings } from './settings.ts';

export type OutgoingEmail = { to: string; fromName: string; fromAddress: string; subject: string; text: string };

export type Mailer = { send(email: OutgoingEmail): Promise<void> };

const SEND_TIMEOUT_MS = 10_000;

export function createGmailMailer(options: { user: string; appPassword: string }): Mailer {
  const transport = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: options.user, pass: options.appPassword },
    connectionTimeout: SEND_TIMEOUT_MS,
    greetingTimeout: SEND_TIMEOUT_MS,
    socketTimeout: SEND_TIMEOUT_MS,
  });
  return {
    async send(email) {
      await transport.sendMail({
        from: { name: email.fromName, address: email.fromAddress },
        to: email.to,
        subject: email.subject,
        text: email.text,
      });
    },
  };
}

export type ApprovalEmailData = {
  code: string;
  gymName: string;
  address: string;
  city: string;
  pincode: string;
  ownerPhone: string;
  totalTrainees: number;
  websiteOrInstagram: string | null;
  applicantName: string | null;
  applicantEmail: string;
  requestedAt: Date;
  expiresAt: Date;
};

function indiaTime(date: Date): string {
  return `${date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })} IST`;
}

/** What FitSphere's team receives: the gym's details and the code to give the owner once satisfied. */
export function approvalEmail(settings: Settings, data: ApprovalEmailData): OutgoingEmail {
  const lines = [
    `A gym has asked to be approved on FitSphere Coach.`,
    ``,
    `Gym name: ${data.gymName}`,
    `Address: ${data.address}, ${data.city} ${data.pincode}`,
    `Total trainees: ${data.totalTrainees}`,
    `Owner phone: ${data.ownerPhone}`,
    ...(data.websiteOrInstagram ? [`Website or Instagram: ${data.websiteOrInstagram}`] : []),
    ``,
    `Requested by: ${data.applicantName ?? '(name not given)'} <${data.applicantEmail}>`,
    `Requested at: ${indiaTime(data.requestedAt)}`,
    `Valid until: ${indiaTime(data.expiresAt)}`,
    ``,
    `Approval code: ${data.code}`,
    ``,
    `Check the gym first. Only if you are satisfied, give this code to the gym owner. The code works once, for this request only, and a new request replaces it.`,
  ];
  return {
    to: settings.approvalInbox,
    fromName: settings.senderDisplayName,
    fromAddress: settings.senderEmail,
    subject: `Gym approval request: ${data.gymName}`,
    text: lines.join('\n'),
  };
}
