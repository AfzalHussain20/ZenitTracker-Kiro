/**
 * TestGenProgress Component Tests
 *
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
 */

import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import TestGenProgress from '../TestGenProgress';

describe('TestGenProgress', () => {
  it('renders all three pass labels in the stepper', () => {
    render(
      <TestGenProgress currentPass={1} passName="Functional" totalGenerated={0} isComplete={false} />
    );
    // The stepper always shows all three pass labels
    const allLabels = screen.getAllByText(/Functional|Negative|Exploratory/);
    expect(allLabels.length).toBeGreaterThanOrEqual(3);
  });

  it('shows the current pass number and pass name while in progress', () => {
    render(
      <TestGenProgress currentPass={2} passName="Negative" totalGenerated={12} isComplete={false} />
    );
    const status = screen.getByText(/Generating batch 2\/3/);
    expect(status).toBeInTheDocument();
    expect(status).toHaveTextContent('Negative');
  });

  it('displays running count of generated test cases', () => {
    render(
      <TestGenProgress currentPass={1} passName="Functional" totalGenerated={7} isComplete={false} />
    );
    expect(screen.getByText('7 cases')).toBeInTheDocument();
  });

  it('uses singular form for 1 test case', () => {
    render(
      <TestGenProgress currentPass={1} passName="Functional" totalGenerated={1} isComplete={false} />
    );
    expect(screen.getByText('1 case')).toBeInTheDocument();
  });

  it('shows generating status while in progress', () => {
    render(
      <TestGenProgress currentPass={1} passName="Functional" totalGenerated={0} isComplete={false} />
    );
    expect(screen.getByText(/Generating batch 1\/3/)).toBeInTheDocument();
  });

  it('shows completion state with success message when isComplete is true', () => {
    render(
      <TestGenProgress currentPass={3} passName="Exploratory" totalGenerated={45} isComplete={true} />
    );
    expect(screen.getByText('Done — 45 test cases generated')).toBeInTheDocument();
  });

  it('displays total count in completion state', () => {
    render(
      <TestGenProgress currentPass={3} passName="Exploratory" totalGenerated={30} isComplete={true} />
    );
    expect(screen.getByText('Done — 30 test cases generated')).toBeInTheDocument();
  });
});
