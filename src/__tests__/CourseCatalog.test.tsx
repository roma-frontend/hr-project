import React from 'react';
import { render, screen } from '@testing-library/react';
import { CourseCatalog } from '@/components/learning/CourseCatalog';
import type { Id } from '../../convex/_generated/dataModel';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));
jest.mock('@/components/employees/EmployeeHoverCard', () => ({
  EmployeeHoverCard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const course = {
  _id: 'course-1' as Id<'courses'>,
  _creationTime: 1,
  organizationId: 'org-1' as Id<'organizations'>,
  title: 'Course',
  category: 'General',
  difficulty: 'beginner' as const,
  createdBy: 'user-1' as Id<'users'>,
  createdAt: 1,
  updatedAt: 1,
  creatorName: 'Admin',
  lessonCount: 1,
};
const props = {
  myEnrollments: [],
  searchQuery: '',
  setSearchQuery: jest.fn(),
  categoryFilter: 'all',
  setCategoryFilter: jest.fn(),
  difficultyFilter: 'all',
  setDifficultyFilter: jest.fn(),
  onEnroll: jest.fn(),
  onSelectCourse: jest.fn(),
};

describe('CourseCatalog exact enrollment state', () => {
  it('shows progress and Continue when the enrollment history page is not loaded', () => {
    render(
      <CourseCatalog
        {...props}
        courses={[
          {
            ...course,
            myEnrollment: { status: 'in_progress', progress: 75 },
          },
        ]}
      />,
    );
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enroll' })).not.toBeInTheDocument();
  });

  it('shows Enroll when the server explicitly returns no enrollment', () => {
    render(<CourseCatalog {...props} courses={[{ ...course, myEnrollment: null }]} />);
    expect(screen.getByRole('button', { name: 'Enroll' })).toBeInTheDocument();
  });
});
