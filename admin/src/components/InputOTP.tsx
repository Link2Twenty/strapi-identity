'use client';

import * as React from 'react';
import { OTPInput, OTPInputContext } from 'input-otp';
import styled, { keyframes } from 'styled-components';

const caretBlink = keyframes`
  0%, 70%, 100% { opacity: 1; }
  20%, 50% { opacity: 0; }
`;

const StyledInputOTPContainer = styled.div`
  display: flex;

  & > div {
    display: inline-flex;
    margin: 0 auto;
  }

  &:has(:disabled) {
    opacity: 0.5;
  }
`;

const StyledOTPInput = styled(OTPInput)`
  display: inline-flex;

  &[disabled] {
    cursor: not-allowed;
  }
`;

const StyledGroup = styled.div`
  display: flex;
  align-items: center;
`;

const StyledSlot = styled.div`
  width: 4rem;
  height: 4rem;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.4rem;
  border-top: 1px solid ${({ theme }) => theme.colors.neutral200};
  border-bottom: 1px solid ${({ theme }) => theme.colors.neutral200};
  border-right: 1px solid ${({ theme }) => theme.colors.neutral200};
  outline: none;
  background: ${({ theme }) => theme.colors.neutral0};

  &:first-child {
    border-left: 1px solid ${({ theme }) => theme.colors.neutral200};
    border-top-left-radius: 0.4rem;
    border-bottom-left-radius: 0.4rem;
  }

  &:last-child {
    border-top-right-radius: 0.4rem;
    border-bottom-right-radius: 0.4rem;
  }

  &[data-active='true'] {
    z-index: 10;
    outline: 2px solid ${({ theme }) => theme.colors.primary600};
    outline-offset: -1px;
  }
`;

const StyledCaret = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
`;

const StyledCaretLine = styled.div`
  height: 2rem;
  width: 1px;
  background-color: ${({ theme }) => theme.colors.neutral800};
  animation: ${caretBlink} 1s infinite;
`;

const StyledSeparator = styled.div`
  display: flex;
  align-items: center;
  padding: 0 0.5rem;
  color: ${({ theme }) => theme.colors.neutral600};

  & > svg {
    width: 1rem;
    height: 1rem;
    fill: currentColor;
  }
`;

function InputOTP({
  className,
  containerClassName,
  ...props
}: React.ComponentPropsWithoutRef<typeof OTPInput> & {
  containerClassName?: string;
}) {
  return (
    <StyledInputOTPContainer className={containerClassName}>
      <StyledOTPInput data-slot="input-otp" spellCheck={false} className={className} {...props} />
    </StyledInputOTPContainer>
  );
}

function InputOTPGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return <StyledGroup data-slot="input-otp-group" className={className} {...props} />;
}

function InputOTPSlot({
  index,
  className,
  ...props
}: React.ComponentProps<'div'> & { index: number }) {
  const inputOTPContext = React.useContext(OTPInputContext);
  const { char, hasFakeCaret, isActive } = inputOTPContext?.slots[index] ?? {};

  return (
    <StyledSlot data-slot="input-otp-slot" data-active={isActive} className={className} {...props}>
      {char}
      {hasFakeCaret && (
        <StyledCaret>
          <StyledCaretLine />
        </StyledCaret>
      )}
    </StyledSlot>
  );
}

function InputOTPSeparator({ ...props }: React.ComponentProps<'div'>) {
  return (
    <StyledSeparator data-slot="input-otp-separator" role="separator" {...props}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        <path d="M4.7 11.06q-.36.12-.57.46c-.1.15-.11.23-.11.48 0 .26.02.33.11.49q.2.32.54.45c.22.08 14.44.08 14.66 0q.34-.13.54-.45c.1-.16.11-.23.11-.49 0-.25-.02-.33-.1-.48a1 1 0 0 0-.59-.46c-.26-.08-14.34-.08-14.6 0" />
      </svg>
    </StyledSeparator>
  );
}

export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator };
