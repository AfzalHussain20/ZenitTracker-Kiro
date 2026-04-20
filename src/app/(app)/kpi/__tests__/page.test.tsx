/**
 * Component tests for KPI Dashboard Page
 * 
 * Tests cover:
 * - Team display and selection
 * - Loading and error states
 * - Responsive design
 * 
 * Requirements: 1.1-1.10, 13.1
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import KPIDashboardPage from '../page';
import { JiraTeam } from '@/types/kpi-dashboard';

// Mock the toast hook
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

// Mock fetch globally
global.fetch = jest.fn();

describe('KPIDashboardPage', () => {
  const mockTeams: JiraTeam[] = [
    {
      id: 'team-1',
      name: 'Dev Team',
      members: [
        {
          accountId: 'user-1',
          displayName: 'John Doe',
          avatarUrl: 'https://example.com/avatar1.jpg',
        },
        {
          accountId: 'user-2',
          displayName: 'Jane Smith',
          avatarUrl: 'https://example.com/avatar2.jpg',
        },
      ],
    },
    {
      id: 'team-2',
      name: 'QA Team',
      members: [
        {
          accountId: 'user-3',
          displayName: 'Bob Wilson',
          avatarUrl: 'https://example.com/avatar3.jpg',
        },
      ],
    },
    {
      id: 'team-3',
      name: 'UI/UX Team',
      members: [
        {
          accountId: 'user-4',
          displayName: 'Alice Brown',
          avatarUrl: 'https://example.com/avatar4.jpg',
        },
        {
          accountId: 'user-5',
          displayName: 'Charlie Davis',
          avatarUrl: 'https://example.com/avatar5.jpg',
        },
      ],
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Team Display', () => {
    it('displays all teams fetched from API', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          teams: mockTeams,
          fromCache: false,
          count: mockTeams.length,
          lastRefresh: new Date().toISOString(),
        }),
      });

      render(<KPIDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Dev Team')).toBeInTheDocument();
        expect(screen.getByText('QA Team')).toBeInTheDocument();
        expect(screen.getByText('UI/UX Team')).toBeInTheDocument();
      });
    });

    it('displays correct member count for each team', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          teams: mockTeams,
          fromCache: false,
          count: mockTeams.length,
        }),
      });

      render(<KPIDashboardPage />);

      await waitFor(() => {
        const memberCounts = screen.getAllByText(/\d+ members?/);
        expect(memberCounts.length).toBeGreaterThan(0);
        expect(screen.getByText('1 member')).toBeInTheDocument();
      });
    });

    it('displays team count in header', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          teams: mockTeams,
          fromCache: false,
          count: mockTeams.length,
        }),
      });

      render(<KPIDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('3')).toBeInTheDocument();
      });
    });

    it('displays cache indicator when data is from cache', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          teams: mockTeams,
          fromCache: true,
          count: mockTeams.length,
        }),
      });

      render(<KPIDashboardPage />);

      await waitFor(() => {
        expect(
          screen.getByText(/Showing cached data \(refreshes every 30 minutes\)/)
        ).toBeInTheDocument();
      });
    });

    it('does not display cache indicator when data is fresh', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          teams: mockTeams,
          fromCache: false,
          count: mockTeams.length,
        }),
      });

      render(<KPIDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Dev Team')).toBeInTheDocument();
      });

      expect(
        screen.queryByText(/Showing cached data/)
      ).not.toBeInTheDocument();
    });
  });

  describe('Team Selection', () => {
    it('opens team member modal when team card is clicked', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          teams: mockTeams,
          fromCache: false,
          count: mockTeams.length,
        }),
      });

      render(<KPIDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Dev Team')).toBeInTheDocument();
      });

      const devTeamCard = screen.getByText('Dev Team').closest('div[class*="cursor-pointer"]');
      fireEvent.click(devTeamCard!);

      await waitFor(() => {
        expect(screen.getByText('2 team members')).toBeInTheDocument();
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      });
    });

    it('displays selected team members in modal', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          teams: mockTeams,
          fromCache: false,
          count: mockTeams.length,
        }),
      });

      render(<KPIDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('QA Team')).toBeInTheDocument();
      });

      const qaTeamCard = screen.getByText('QA Team').closest('div[class*="cursor-pointer"]');
      fireEvent.click(qaTeamCard!);

      await waitFor(() => {
        expect(screen.getByText('1 team members')).toBeInTheDocument();
        expect(screen.getByText('Bob Wilson')).toBeInTheDocument();
      });
    });

    it('closes modal when close button is clicked', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          teams: mockTeams,
          fromCache: false,
          count: mockTeams.length,
        }),
      });

      render(<KPIDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Dev Team')).toBeInTheDocument();
      });

      const devTeamCard = screen.getByText('Dev Team').closest('div[class*="cursor-pointer"]');
      fireEvent.click(devTeamCard!);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const closeButton = screen.getByText('Close');
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByText('2 team members')).not.toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    it('displays loading spinner on initial load', () => {
      (global.fetch as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(<KPIDashboardPage />);

      expect(screen.getByText('Loading teams...')).toBeInTheDocument();
    });

    it('displays refreshing state when refresh button is clicked', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            teams: mockTeams,
            fromCache: false,
            count: mockTeams.length,
          }),
        })
        .mockImplementation(
          () => new Promise(() => {}) // Never resolves for refresh
        );

      render(<KPIDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Dev Team')).toBeInTheDocument();
      });

      const refreshButton = screen.getByText('Refresh');
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(screen.getByText('Refreshing...')).toBeInTheDocument();
      });
    });

    it('disables refresh button while refreshing', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            teams: mockTeams,
            fromCache: false,
            count: mockTeams.length,
          }),
        })
        .mockImplementation(
          () => new Promise(() => {}) // Never resolves
        );

      render(<KPIDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Dev Team')).toBeInTheDocument();
      });

      const refreshButton = screen.getByText('Refresh').closest('button');
      fireEvent.click(refreshButton!);

      await waitFor(() => {
        expect(refreshButton).toBeDisabled();
      });
    });

    it('hides loading state after teams are loaded', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          teams: mockTeams,
          fromCache: false,
          count: mockTeams.length,
        }),
      });

      render(<KPIDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Dev Team')).toBeInTheDocument();
      });

      expect(screen.queryByText('Loading teams...')).not.toBeInTheDocument();
    });
  });

  describe('Error States', () => {
    it('displays error message when API fails', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
      });

      render(<KPIDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Error Loading Teams')).toBeInTheDocument();
        expect(
          screen.getByText(/Failed to fetch teams: Internal Server Error/)
        ).toBeInTheDocument();
      });
    });

    it('displays retry button on error', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
      });

      render(<KPIDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });
    });

    it('retries fetching teams when retry button is clicked', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          statusText: 'Internal Server Error',
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            teams: mockTeams,
            fromCache: false,
            count: mockTeams.length,
          }),
        });

      render(<KPIDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Error Loading Teams')).toBeInTheDocument();
      });

      const retryButton = screen.getByText('Retry');
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText('Dev Team')).toBeInTheDocument();
      });
    });

    it('handles network errors gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Network error')
      );

      render(<KPIDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Error Loading Teams')).toBeInTheDocument();
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('displays empty state when no teams are found', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          teams: [],
          fromCache: false,
          count: 0,
        }),
      });

      render(<KPIDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('No Teams Found')).toBeInTheDocument();
        expect(
          screen.getByText(
            /No teams were discovered from Jira. Try refreshing or check your configuration./
          )
        ).toBeInTheDocument();
      });
    });

    it('displays refresh button in empty state', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          teams: [],
          fromCache: false,
          count: 0,
        }),
      });

      render(<KPIDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('No Teams Found')).toBeInTheDocument();
      });

      const refreshButtons = screen.getAllByText('Refresh Teams');
      expect(refreshButtons.length).toBeGreaterThan(0);
    });
  });

  describe('Responsive Design', () => {
    it('renders header with dashboard title', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          teams: mockTeams,
          fromCache: false,
          count: mockTeams.length,
        }),
      });

      render(<KPIDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText(/KPI/)).toBeInTheDocument();
        expect(screen.getByText(/Dashboard/)).toBeInTheDocument();
      });
    });

    it('displays last refresh timestamp', async () => {
      const lastRefresh = new Date().toISOString();
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          teams: mockTeams,
          fromCache: false,
          count: mockTeams.length,
          lastRefresh,
        }),
      });

      render(<KPIDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Last Refresh')).toBeInTheDocument();
        expect(screen.getByText('Just now')).toBeInTheDocument();
      });
    });

    it('renders teams in grid layout', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          teams: mockTeams,
          fromCache: false,
          count: mockTeams.length,
        }),
      });

      const { container } = render(<KPIDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Dev Team')).toBeInTheDocument();
      });

      const grid = container.querySelector('.grid');
      expect(grid).toBeInTheDocument();
      expect(grid).toHaveClass('grid-cols-1');
      expect(grid).toHaveClass('md:grid-cols-2');
      expect(grid).toHaveClass('lg:grid-cols-3');
    });

    it('displays team type badge for each team', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          teams: mockTeams,
          fromCache: false,
          count: mockTeams.length,
        }),
      });

      render(<KPIDashboardPage />);

      await waitFor(() => {
        const badges = screen.getAllByText('generic');
        expect(badges.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Refresh Functionality', () => {
    it('calls POST endpoint when refresh button is clicked', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            teams: mockTeams,
            fromCache: false,
            count: mockTeams.length,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            teams: mockTeams,
            fromCache: false,
            count: mockTeams.length,
          }),
        });

      render(<KPIDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Dev Team')).toBeInTheDocument();
      });

      const refreshButton = screen.getByText('Refresh');
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/jira/teams',
          { method: 'POST' }
        );
      });
    });

    it('updates last refresh timestamp after refresh', async () => {
      const initialRefresh = new Date(Date.now() - 60000).toISOString(); // 1 minute ago
      const newRefresh = new Date().toISOString();

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            teams: mockTeams,
            fromCache: false,
            count: mockTeams.length,
            lastRefresh: initialRefresh,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            teams: mockTeams,
            fromCache: false,
            count: mockTeams.length,
            lastRefresh: newRefresh,
          }),
        });

      render(<KPIDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('1 minute ago')).toBeInTheDocument();
      });

      const refreshButton = screen.getByText('Refresh');
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(screen.getByText('Just now')).toBeInTheDocument();
      });
    });
  });

  describe('Team Member Display', () => {
    it('displays member avatars in modal', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          teams: mockTeams,
          fromCache: false,
          count: mockTeams.length,
        }),
      });

      render(<KPIDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Dev Team')).toBeInTheDocument();
      });

      const devTeamCard = screen.getByText('Dev Team').closest('div[class*="cursor-pointer"]');
      fireEvent.click(devTeamCard!);

      await waitFor(() => {
        const images = screen.getAllByRole('img');
        expect(images.length).toBeGreaterThan(0);
      });
    });

    it('displays member account IDs in modal', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          teams: mockTeams,
          fromCache: false,
          count: mockTeams.length,
        }),
      });

      render(<KPIDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Dev Team')).toBeInTheDocument();
      });

      const devTeamCard = screen.getByText('Dev Team').closest('div[class*="cursor-pointer"]');
      fireEvent.click(devTeamCard!);

      await waitFor(() => {
        expect(screen.getByText('user-1')).toBeInTheDocument();
        expect(screen.getByText('user-2')).toBeInTheDocument();
      });
    });

    it('displays fallback initials when no avatar URL', async () => {
      const teamsWithoutAvatars = [
        {
          ...mockTeams[0],
          members: [
            {
              accountId: 'user-1',
              displayName: 'John Doe',
            },
          ],
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          teams: teamsWithoutAvatars,
          fromCache: false,
          count: 1,
        }),
      });

      render(<KPIDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Dev Team')).toBeInTheDocument();
      });

      const devTeamCard = screen.getByText('Dev Team').closest('div[class*="cursor-pointer"]');
      fireEvent.click(devTeamCard!);

      await waitFor(() => {
        expect(screen.getByText('J')).toBeInTheDocument();
      });
    });
  });

  describe('Member Profile Modal', () => {
    it('opens member profile modal when member card is clicked', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          teams: mockTeams,
          fromCache: false,
          count: mockTeams.length,
        }),
      });

      render(<KPIDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Dev Team')).toBeInTheDocument();
      });

      // Open team modal
      const devTeamCard = screen.getByText('Dev Team').closest('div[class*="cursor-pointer"]');
      fireEvent.click(devTeamCard!);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Click on member card
      const memberCards = screen.getAllByTestId('member-card');
      fireEvent.click(memberCards[0]);

      await waitFor(() => {
        expect(screen.getByTestId('member-profile-modal')).toBeInTheDocument();
      });
    });

    it('displays member profile information in modal', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          teams: mockTeams,
          fromCache: false,
          count: mockTeams.length,
        }),
      });

      render(<KPIDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Dev Team')).toBeInTheDocument();
      });

      // Open team modal
      const devTeamCard = screen.getByText('Dev Team').closest('div[class*="cursor-pointer"]');
      fireEvent.click(devTeamCard!);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Click on member card
      const memberCards = screen.getAllByTestId('member-card');
      fireEvent.click(memberCards[0]);

      await waitFor(() => {
        // Check for profile information sections
        expect(screen.getByText('Profile Information')).toBeInTheDocument();
        expect(screen.getByText('Full Name')).toBeInTheDocument();
        expect(screen.getByText('Team')).toBeInTheDocument();
        expect(screen.getByText('Role')).toBeInTheDocument();
      });
    });

    it('displays team name in member profile modal', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          teams: mockTeams,
          fromCache: false,
          count: mockTeams.length,
        }),
      });

      render(<KPIDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Dev Team')).toBeInTheDocument();
      });

      // Open team modal
      const devTeamCard = screen.getByText('Dev Team').closest('div[class*="cursor-pointer"]');
      fireEvent.click(devTeamCard!);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Click on member card
      const memberCards = screen.getAllByTestId('member-card');
      fireEvent.click(memberCards[0]);

      await waitFor(() => {
        // Should show team name in the modal description
        const teamReferences = screen.getAllByText(/Dev Team/);
        expect(teamReferences.length).toBeGreaterThan(0);
      });
    });

    it('displays placeholder sections for future implementation', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          teams: mockTeams,
          fromCache: false,
          count: mockTeams.length,
        }),
      });

      render(<KPIDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Dev Team')).toBeInTheDocument();
      });

      // Open team modal
      const devTeamCard = screen.getByText('Dev Team').closest('div[class*="cursor-pointer"]');
      fireEvent.click(devTeamCard!);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Click on member card
      const memberCards = screen.getAllByTestId('member-card');
      fireEvent.click(memberCards[0]);

      await waitFor(() => {
        expect(screen.getByText('Performance Metrics')).toBeInTheDocument();
        expect(screen.getByText('Worklog History')).toBeInTheDocument();
        expect(screen.getByText('Day-Wise Activity')).toBeInTheDocument();
      });
    });

    it('closes member profile modal when dialog is closed', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          teams: mockTeams,
          fromCache: false,
          count: mockTeams.length,
        }),
      });

      render(<KPIDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Dev Team')).toBeInTheDocument();
      });

      // Open team modal
      const devTeamCard = screen.getByText('Dev Team').closest('div[class*="cursor-pointer"]');
      fireEvent.click(devTeamCard!);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Click on member card
      const memberCards = screen.getAllByTestId('member-card');
      fireEvent.click(memberCards[0]);

      await waitFor(() => {
        expect(screen.getByTestId('member-profile-modal')).toBeInTheDocument();
      });

      // Close the modal by pressing Escape (simulated by onOpenChange)
      const dialog = screen.getByTestId('member-profile-modal').closest('[role="dialog"]');
      if (dialog) {
        fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' });
      }

      // Modal should close
      await waitFor(() => {
        expect(screen.queryByTestId('member-profile-modal')).not.toBeInTheDocument();
      }, { timeout: 1000 });
    });
  });
});
