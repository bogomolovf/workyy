import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CallParticipant } from '../../state/audioCallStore';
import { AudioCallPanel } from '../AudioCallPanel';

// Mock @phosphor-icons/react
vi.mock('@phosphor-icons/react', () => ({
  Phone: ({ weight, className }: { weight?: string; className?: string }) => (
    <span data-testid="phone-icon" data-weight={weight} className={className}>
      📞
    </span>
  ),
  PhoneDisconnect: ({ weight, className }: { weight?: string; className?: string }) => (
    <span data-testid="phone-disconnect-icon" data-weight={weight} className={className}>
      📵
    </span>
  ),
  Microphone: ({ weight, className }: { weight?: string; className?: string }) => (
    <span data-testid="microphone-icon" data-weight={weight} className={className}>
      🎤
    </span>
  ),
  MicrophoneSlash: ({ weight, className }: { weight?: string; className?: string }) => (
    <span data-testid="microphone-slash-icon" data-weight={weight} className={className}>
      🔇
    </span>
  ),
  Users: ({ weight, className }: { weight?: string; className?: string }) => (
    <span data-testid="users-icon" data-weight={weight} className={className}>
      👥
    </span>
  ),
}));

const mockParticipants: Record<string, CallParticipant> = {
  'client-1': {
    odielId: 'user-1',
    clientId: 'client-1',
    name: 'Alice',
    muted: false,
    speaking: false,
  },
  'client-2': {
    odielId: 'user-2',
    clientId: 'client-2',
    name: 'Bob',
    muted: true,
    speaking: false,
  },
};

describe('AudioCallPanel', () => {
  let mockOnJoin: ReturnType<typeof vi.fn>;
  let mockOnLeave: ReturnType<typeof vi.fn>;
  let mockOnToggleMute: ReturnType<typeof vi.fn>;
  let mockOnTogglePanel: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnJoin = vi.fn();
    mockOnLeave = vi.fn();
    mockOnToggleMute = vi.fn();
    mockOnTogglePanel = vi.fn();
    console.log('[AudioCallPanel.test] Mocks reset');
  });

  describe('Not in call state', () => {
    it('renders "Позвонить" button when not in call and no active call', () => {
      console.log('[TEST] Rendering AudioCallPanel - not in call, no active call');
      render(
        <AudioCallPanel
          inCall={false}
          localMuted={false}
          participants={{}}
          panelOpen={false}
          error={null}
          activeCallParticipantCount={0}
          onJoin={mockOnJoin}
          onLeave={mockOnLeave}
          onToggleMute={mockOnToggleMute}
          onTogglePanel={mockOnTogglePanel}
        />,
      );

      const joinButton = screen.getByRole('button', { name: /позвонить/i });
      console.log('[TEST] Found join button:', joinButton.textContent);
      expect(joinButton).toBeInTheDocument();
      expect(screen.getByTestId('phone-icon')).toBeInTheDocument();
    });

    it('renders "Присоединиться" button when there is an active call', () => {
      console.log('[TEST] Rendering AudioCallPanel - not in call, active call with 2 participants');
      render(
        <AudioCallPanel
          inCall={false}
          localMuted={false}
          participants={{}}
          panelOpen={false}
          error={null}
          activeCallParticipantCount={2}
          onJoin={mockOnJoin}
          onLeave={mockOnLeave}
          onToggleMute={mockOnToggleMute}
          onTogglePanel={mockOnTogglePanel}
        />,
      );

      const joinButton = screen.getByRole('button', { name: /присоединиться/i });
      console.log('[TEST] Found join button:', joinButton.textContent);
      expect(joinButton).toBeInTheDocument();
      expect(joinButton.textContent).toContain('2');
    });

    it('calls onJoin when Join Call button is clicked', () => {
      render(
        <AudioCallPanel
          inCall={false}
          localMuted={false}
          participants={{}}
          panelOpen={false}
          error={null}
          onJoin={mockOnJoin}
          onLeave={mockOnLeave}
          onToggleMute={mockOnToggleMute}
          onTogglePanel={mockOnTogglePanel}
        />,
      );

      const joinButton = screen.getByRole('button', { name: /позвонить/i });
      fireEvent.click(joinButton);

      console.log('[TEST] onJoin called times:', mockOnJoin.mock.calls.length);
      expect(mockOnJoin).toHaveBeenCalledTimes(1);
    });

    it('displays error message when error prop is set and not in call', () => {
      const errorMessage = 'Microphone access denied';
      console.log('[TEST] Rendering with error:', errorMessage);

      render(
        <AudioCallPanel
          inCall={false}
          localMuted={false}
          participants={{}}
          panelOpen={false}
          error={errorMessage}
          onJoin={mockOnJoin}
          onLeave={mockOnLeave}
          onToggleMute={mockOnToggleMute}
          onTogglePanel={mockOnTogglePanel}
        />,
      );

      const errorEl = screen.getByText(errorMessage);
      console.log('[TEST] Error element found:', errorEl.textContent);
      expect(errorEl).toBeInTheDocument();
    });
  });

  describe('In call state', () => {
    it('renders mute button, participant count, and leave button when in call', () => {
      console.log('[TEST] Rendering AudioCallPanel - in call with participants');
      render(
        <AudioCallPanel
          inCall={true}
          localMuted={false}
          participants={mockParticipants}
          panelOpen={false}
          error={null}
          onJoin={mockOnJoin}
          onLeave={mockOnLeave}
          onToggleMute={mockOnToggleMute}
          onTogglePanel={mockOnTogglePanel}
        />,
      );

      // Should have mute button (microphone icon, not slash since not muted)
      expect(screen.getByTestId('microphone-icon')).toBeInTheDocument();
      // Should have leave button
      expect(screen.getByTestId('phone-disconnect-icon')).toBeInTheDocument();
      // Should have users icon for participant count
      expect(screen.getByTestId('users-icon')).toBeInTheDocument();
      // Participant count: 2 remote + 1 local = 3
      expect(screen.getByText('3')).toBeInTheDocument();
      console.log('[TEST] In call UI elements verified');
    });

    it('shows microphone-slash icon when muted', () => {
      console.log('[TEST] Rendering with localMuted=true');
      render(
        <AudioCallPanel
          inCall={true}
          localMuted={true}
          participants={{}}
          panelOpen={false}
          error={null}
          onJoin={mockOnJoin}
          onLeave={mockOnLeave}
          onToggleMute={mockOnToggleMute}
          onTogglePanel={mockOnTogglePanel}
        />,
      );

      expect(screen.getByTestId('microphone-slash-icon')).toBeInTheDocument();
      console.log('[TEST] Microphone slash icon shown when muted');
    });

    it('calls onToggleMute when mute button is clicked', () => {
      render(
        <AudioCallPanel
          inCall={true}
          localMuted={false}
          participants={{}}
          panelOpen={false}
          error={null}
          onJoin={mockOnJoin}
          onLeave={mockOnLeave}
          onToggleMute={mockOnToggleMute}
          onTogglePanel={mockOnTogglePanel}
        />,
      );

      const muteButton = screen.getByTitle(/mute/i);
      fireEvent.click(muteButton);

      console.log('[TEST] onToggleMute called times:', mockOnToggleMute.mock.calls.length);
      expect(mockOnToggleMute).toHaveBeenCalledTimes(1);
    });

    it('calls onLeave when leave button is clicked', () => {
      render(
        <AudioCallPanel
          inCall={true}
          localMuted={false}
          participants={{}}
          panelOpen={false}
          error={null}
          onJoin={mockOnJoin}
          onLeave={mockOnLeave}
          onToggleMute={mockOnToggleMute}
          onTogglePanel={mockOnTogglePanel}
        />,
      );

      const leaveButton = screen.getByTitle(/leave/i);
      fireEvent.click(leaveButton);

      console.log('[TEST] onLeave called times:', mockOnLeave.mock.calls.length);
      expect(mockOnLeave).toHaveBeenCalledTimes(1);
    });

    it('calls onTogglePanel when participant count button is clicked', () => {
      render(
        <AudioCallPanel
          inCall={true}
          localMuted={false}
          participants={mockParticipants}
          panelOpen={false}
          error={null}
          onJoin={mockOnJoin}
          onLeave={mockOnLeave}
          onToggleMute={mockOnToggleMute}
          onTogglePanel={mockOnTogglePanel}
        />,
      );

      const participantButton = screen.getByTitle(/show call participants/i);
      fireEvent.click(participantButton);

      console.log('[TEST] onTogglePanel called times:', mockOnTogglePanel.mock.calls.length);
      expect(mockOnTogglePanel).toHaveBeenCalledTimes(1);
    });

    it('displays error message when in call with error', () => {
      const errorMessage = 'Connection failed';
      render(
        <AudioCallPanel
          inCall={true}
          localMuted={false}
          participants={{}}
          panelOpen={false}
          error={errorMessage}
          onJoin={mockOnJoin}
          onLeave={mockOnLeave}
          onToggleMute={mockOnToggleMute}
          onTogglePanel={mockOnTogglePanel}
        />,
      );

      const errorEl = screen.getByText(errorMessage);
      console.log('[TEST] Error in call state:', errorEl.textContent);
      expect(errorEl).toBeInTheDocument();
    });
  });

  describe('Panel expanded state', () => {
    it('shows participant list when panelOpen is true', () => {
      console.log('[TEST] Rendering with panelOpen=true');
      render(
        <AudioCallPanel
          inCall={true}
          localMuted={false}
          participants={mockParticipants}
          panelOpen={true}
          error={null}
          currentUserName="Charlie"
          onJoin={mockOnJoin}
          onLeave={mockOnLeave}
          onToggleMute={mockOnToggleMute}
          onTogglePanel={mockOnTogglePanel}
        />,
      );

      // Should show current user
      expect(screen.getByText(/charlie/i)).toBeInTheDocument();
      expect(screen.getByText(/вы/i)).toBeInTheDocument();
      // Should show remote participants
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
      console.log('[TEST] Participant list displayed correctly');
    });

    it('shows muted indicator for muted participants', () => {
      console.log('[TEST] Checking muted indicator for Bob');
      render(
        <AudioCallPanel
          inCall={true}
          localMuted={false}
          participants={mockParticipants}
          panelOpen={true}
          error={null}
          onJoin={mockOnJoin}
          onLeave={mockOnLeave}
          onToggleMute={mockOnToggleMute}
          onTogglePanel={mockOnTogglePanel}
        />,
      );

      // Bob is muted, should have microphone-slash icon near his name
      const micSlashIcons = screen.getAllByTestId('microphone-slash-icon');
      console.log('[TEST] Microphone slash icons count:', micSlashIcons.length);
      // At least one for Bob who is muted
      expect(micSlashIcons.length).toBeGreaterThanOrEqual(1);
    });

    it('does not show participant list when panelOpen is false', () => {
      render(
        <AudioCallPanel
          inCall={true}
          localMuted={false}
          participants={mockParticipants}
          panelOpen={false}
          error={null}
          onJoin={mockOnJoin}
          onLeave={mockOnLeave}
          onToggleMute={mockOnToggleMute}
          onTogglePanel={mockOnTogglePanel}
        />,
      );

      // Should not show participant names in expanded list
      expect(screen.queryByText('Alice')).not.toBeInTheDocument();
      expect(screen.queryByText('Bob')).not.toBeInTheDocument();
      console.log('[TEST] Participant list hidden when panel closed');
    });

    it('shows "You" as default when currentUserName is not provided', () => {
      render(
        <AudioCallPanel
          inCall={true}
          localMuted={false}
          participants={{}}
          panelOpen={true}
          error={null}
          onJoin={mockOnJoin}
          onLeave={mockOnLeave}
          onToggleMute={mockOnToggleMute}
          onTogglePanel={mockOnTogglePanel}
        />,
      );

      expect(screen.getByText(/you/i)).toBeInTheDocument();
      console.log('[TEST] Default "You" label shown');
    });
  });

  describe('Edge cases', () => {
    it('handles empty participants gracefully', () => {
      console.log('[TEST] Rendering with empty participants');
      render(
        <AudioCallPanel
          inCall={true}
          localMuted={false}
          participants={{}}
          panelOpen={true}
          error={null}
          onJoin={mockOnJoin}
          onLeave={mockOnLeave}
          onToggleMute={mockOnToggleMute}
          onTogglePanel={mockOnTogglePanel}
        />,
      );

      // Only current user (1 person)
      expect(screen.getByText('1')).toBeInTheDocument();
      console.log('[TEST] Empty participants handled - shows 1 (current user)');
    });

    it('does not render leave/mute buttons when not in call', () => {
      render(
        <AudioCallPanel
          inCall={false}
          localMuted={false}
          participants={{}}
          panelOpen={false}
          error={null}
          onJoin={mockOnJoin}
          onLeave={mockOnLeave}
          onToggleMute={mockOnToggleMute}
          onTogglePanel={mockOnTogglePanel}
        />,
      );

      expect(screen.queryByTitle(/leave/i)).not.toBeInTheDocument();
      expect(screen.queryByTitle(/mute/i)).not.toBeInTheDocument();
      console.log('[TEST] No leave/mute buttons when not in call');
    });
  });
});
