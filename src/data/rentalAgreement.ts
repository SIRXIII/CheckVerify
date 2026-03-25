export interface AgreementSection {
  title: string;
  body: string;
}

export interface AgreementData {
  guestName: string;
  checkInDate: string;
  checkOutDate: string;
  totalAmount: string;
}

export const rentalAgreementSections: AgreementSection[] = [
  {
    title: 'Authorization of Charges',
    body: 'I, {{guestName}}, hereby authorize HOST LA PR to process the charges for my reservation. This authorization applies to the total rental amount and any additional charges incurred during my stay.',
  },
  {
    title: 'Total Rental Amount',
    body: 'Total of {{totalAmount}} includes all applicable taxes and fees.',
  },
  {
    title: 'Additional Charges',
    body: 'Any additional charges incurred during the rental period (e.g., damages, extra services) will be charged to the credit card on file.',
  },
  {
    title: 'Cancellation Policy',
    body: 'Cancellations made within 30 days of check-in ({{checkInDate}}) are NON-refundable.',
  },
  {
    title: 'No-Show Policy',
    body: 'No-shows are NON-refundable. Date changes will be handled at management discretion based on availability.',
  },
  {
    title: 'Damage Liability',
    body: 'Guest is responsible for any damages to the property during the rental period and authorizes credit card charges for any necessary repairs or replacements.',
  },
  {
    title: 'Refund Policy',
    body: 'Eligible refunds will be made to the original payment method only, no exceptions.',
  },
  {
    title: 'Signature Requirement',
    body: "Signature on this form must match the signature on the cardholder's government-issued ID.",
  },
  {
    title: 'Check-In / Check-Out',
    body: 'Check-in after 3:00 PM, check-out by 11:00 AM. Early check-in or late check-out arrangements are subject to availability and may incur additional fees.',
  },
  {
    title: 'Property Rules',
    body: 'No smoking on the premises. No excessive noise after 10 PM. Maximum occupancy as listed in the reservation. No unauthorized pets. No parties or events without prior written approval.',
  },
  {
    title: 'Liability Waiver',
    body: 'Host LA is not liable for personal injury, property loss, or damage during the rental period. Guests assume all risk associated with the use of the property and its amenities.',
  },
  {
    title: 'Chargeback Policy',
    body: 'Chargebacks filed for completed stays will be considered fraud and pursued legally to the fullest extent of the law. By signing this agreement, {{guestName}} acknowledges that initiating a chargeback after completing a stay constitutes a fraudulent claim and agrees to bear all costs associated with dispute resolution, including legal fees.',
  },
  {
    title: 'Governing Law',
    body: 'This agreement is governed by the laws of the state where the rental property is located. Any disputes arising from this agreement shall be resolved in the appropriate jurisdiction.',
  },
];

export function interpolateAgreement(
  sections: AgreementSection[],
  data: AgreementData
): AgreementSection[] {
  return sections.map((section) => ({
    title: section.title,
    body: section.body
      .replace(/\{\{guestName\}\}/g, data.guestName)
      .replace(/\{\{checkInDate\}\}/g, data.checkInDate)
      .replace(/\{\{checkOutDate\}\}/g, data.checkOutDate)
      .replace(/\{\{totalAmount\}\}/g, data.totalAmount),
  }));
}
