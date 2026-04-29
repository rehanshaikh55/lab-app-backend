export class DomainError extends Error {
  constructor(code, status, detail, instance = '/') {
    super(detail);
    this.code = code;
    this.statusCode = status;
    this.detail = detail;
    this.instance = instance;
  }

  toRFC7807() {
    return {
      type: `https://labzy.in/errors/${this.code}`,
      title: this.code.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      status: this.statusCode,
      detail: this.detail,
      instance: this.instance,
    };
  }
}

export const Errors = {
  SLOT_UNAVAILABLE: (detail, instance) =>
    new DomainError('SLOT_UNAVAILABLE', 409, detail || 'Slot is unavailable', instance),
  BOOKING_NOT_FOUND: (instance) =>
    new DomainError('BOOKING_NOT_FOUND', 404, 'Booking not found or access denied', instance),
  INVALID_BOOKING_TRANSITION: (detail) =>
    new DomainError('INVALID_BOOKING_TRANSITION', 409, detail || 'Invalid booking state transition'),
  PAYMENT_FAILED: (detail) =>
    new DomainError('PAYMENT_FAILED', 402, detail || 'Payment failed'),
  REPORT_ACCESS_DENIED: () =>
    new DomainError('REPORT_ACCESS_DENIED', 403, 'Not authorized for this report'),
  LAB_CLOSED: (detail) =>
    new DomainError('LAB_CLOSED', 422, detail || 'Lab is not open at the requested time'),
  ASSISTANT_UNAVAILABLE: () =>
    new DomainError('ASSISTANT_UNAVAILABLE', 409, 'No available assistant'),
  WEBHOOK_SIGNATURE_INVALID: () =>
    new DomainError('WEBHOOK_SIGNATURE_INVALID', 401, 'HMAC signature mismatch'),
  INVALID_SUBSCRIPTION_STATE: (detail) =>
    new DomainError('INVALID_SUBSCRIPTION_STATE', 409, detail || 'Invalid subscription state transition'),
  FILE_TOO_LARGE: () =>
    new DomainError('FILE_TOO_LARGE', 413, 'Upload exceeds 10MB limit'),
  INVALID_FILE_TYPE: () =>
    new DomainError('INVALID_FILE_TYPE', 415, 'Only PDF accepted for reports'),
  NOT_FOUND: (resource, instance) =>
    new DomainError('NOT_FOUND', 404, `${resource || 'Resource'} not found`, instance),
  UNAUTHORIZED: () =>
    new DomainError('UNAUTHORIZED', 401, 'Authentication required'),
  FORBIDDEN: () =>
    new DomainError('FORBIDDEN', 403, 'Insufficient permissions'),
  CONFLICT: (detail) =>
    new DomainError('CONFLICT', 409, detail || 'Conflict'),
  VALIDATION_ERROR: (detail) =>
    new DomainError('VALIDATION_ERROR', 400, detail || 'Validation error'),
};
