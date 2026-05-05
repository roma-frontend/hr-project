'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/useAuthStore';
import { ShieldLoader } from '@/components/ui/ShieldLoader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import {
  BookOpen,
  Search,
  GraduationCap,
  Award,
  BarChart3,
  Plus,
  Play,
  CheckCircle2,
  Clock,
  Star,
  Users,
  TrendingUp,
  Filter,
  ChevronRight,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useSelectedOrganization } from '@/hooks/useSelectedOrganization';

// ─── Types ────────────────────────────────────────────────────
type CourseWithLessons = {
  _id: Id<'courses'>;
  _creationTime: number;
  organizationId: Id<'organizations'>;
  title: string;
  description?: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedHours?: number;
  thumbnailUrl?: string;
  createdBy: Id<'users'>;
  isPublished?: boolean;
  isMandatory?: boolean;
  tags?: string[];
  createdAt: number;
  updatedAt: number;
  creatorName: string;
  lessonCount: number;
};

type EnrollmentWithCourse = {
  _id: Id<'enrollments'>;
  _creationTime: number;
  organizationId: Id<'organizations'>;
  userId: Id<'users'>;
  courseId: Id<'courses'>;
  status: 'not_started' | 'in_progress' | 'completed' | 'expired';
  progress?: number;
  enrolledBy?: Id<'users'>;
  startedAt?: number;
  completedAt?: number;
  expiresAt?: number;
  createdAt: number;
  updatedAt: number;
  courseTitle: string;
  course?: CourseWithLessons;
};

// ─── Main Component ───────────────────────────────────────────
export default function LearningClient() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const selectedOrgId = useSelectedOrganization();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const effectiveOrgId = selectedOrgId ?? user?.organizationId;

  const [activeTab, setActiveTab] = useState('catalog');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [selectedCourse, setSelectedCourse] = useState<CourseWithLessons | null>(null);
  const [showCourseDetail, setShowCourseDetail] = useState(false);
  const [showCreateCourse, setShowCreateCourse] = useState(false);
  const [courseForm, setCourseForm] = useState({
    title: '',
    description: '',
    category: '',
    difficulty: 'beginner' as 'beginner' | 'intermediate' | 'advanced',
    estimatedHours: '',
    isMandatory: false,
    tags: '',
  });

  // Fetch data
  const courses = useQuery(
    api.learning.listCourses,
    effectiveOrgId && user?.id
      ? {
          organizationId: effectiveOrgId as Id<'organizations'>,
          requesterId: user.id as Id<'users'>,
          includeUnpublished: isAdmin,
        }
      : 'skip',
  );

  const myEnrollments = useQuery(
    api.learning.getMyEnrollments,
    effectiveOrgId && user?.id
      ? {
          organizationId: effectiveOrgId as Id<'organizations'>,
          requesterId: user.id as Id<'users'>,
        }
      : 'skip',
  );

  const teamOverview = useQuery(
    api.learning.getTeamLearningOverview,
    effectiveOrgId && user?.id && isAdmin
      ? {
          organizationId: effectiveOrgId as Id<'organizations'>,
          requesterId: user.id as Id<'users'>,
        }
      : 'skip',
  );

  // Mutations
  const enrollMutation = useMutation(api.learning.enrollInCourse);
  const createCourseMutation = useMutation(api.learning.createCourse);

  // Filter courses
  const filteredCourses = useMemo(() => {
    if (!courses) return [];
    let result = courses;

    if (searchQuery) {
      const lower = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.title.toLowerCase().includes(lower) || c.description?.toLowerCase().includes(lower),
      );
    }

    if (categoryFilter !== 'all') {
      result = result.filter((c) => c.category === categoryFilter);
    }

    if (difficultyFilter !== 'all') {
      result = result.filter((c) => c.difficulty === difficultyFilter);
    }

    return result;
  }, [courses, searchQuery, categoryFilter, difficultyFilter]);

  // Get unique categories
  const categories = useMemo(() => {
    if (!courses) return [];
    return [...new Set(courses.map((c) => c.category))];
  }, [courses]);

  const handleEnroll = async (courseId: Id<'courses'>) => {
    if (!effectiveOrgId || !user?.id) return;

    try {
      const result = await enrollMutation({
        organizationId: effectiveOrgId as Id<'organizations'>,
        requesterId: user.id as Id<'users'>,
        courseId,
      });

      if (result.success) {
        toast.success(t('learning.enrollSuccess', 'Successfully enrolled in course'));
      } else {
        toast.info(result.message || t('learning.alreadyEnrolled', 'Already enrolled'));
      }
    } catch {
      toast.error(t('learning.enrollError', 'Failed to enroll in course'));
    }
  };

  const handleCreateCourse = async () => {
    if (!effectiveOrgId || !user?.id) return;
    if (!courseForm.title.trim()) {
      toast.error(t('errors.required', 'Title is required'));
      return;
    }
    if (!courseForm.category.trim()) {
      toast.error(t('errors.required', 'Category is required'));
      return;
    }

    try {
      await createCourseMutation({
        organizationId: effectiveOrgId as Id<'organizations'>,
        requesterId: user.id as Id<'users'>,
        title: courseForm.title.trim(),
        description: courseForm.description.trim() || undefined,
        category: courseForm.category.trim(),
        difficulty: courseForm.difficulty,
        estimatedHours: courseForm.estimatedHours
          ? parseInt(courseForm.estimatedHours, 10)
          : undefined,
        isMandatory: courseForm.isMandatory,
        tags: courseForm.tags
          ? courseForm.tags
              .split(',')
              .map((tag) => tag.trim())
              .filter(Boolean)
          : undefined,
      });

      toast.success(t('learning.courseCreated', 'Course created successfully'));
      setShowCreateCourse(false);
      setCourseForm({
        title: '',
        description: '',
        category: '',
        difficulty: 'beginner',
        estimatedHours: '',
        isMandatory: false,
        tags: '',
      });
    } catch {
      toast.error(t('learning.courseCreateError', 'Failed to create course'));
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'intermediate':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'advanced':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'not_started':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const isEnrolled = (courseId: Id<'courses'>) => {
    return myEnrollments?.some((e) => e.courseId === courseId);
  };

  const getEnrollmentProgress = (courseId: Id<'courses'>) => {
    const enrollment = myEnrollments?.find((e) => e.courseId === courseId);
    return enrollment?.progress ?? 0;
  };

  // Loading state
  if (courses === undefined) {
    return (
      <div className="flex items-center justify-center h-96">
        <ShieldLoader message={t('learning.loading', 'Loading courses...')} />
      </div>
    );
  }

  return (
    <div className="mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            {t('learning.title', 'Learning Center')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t('learning.subtitle', 'Develop your skills and grow your career')}
          </p>
        </div>

        {isAdmin && (
          <Button onClick={() => setShowCreateCourse(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {t('learning.createCourse', 'Create Course')}
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      {isAdmin && teamOverview && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <BookOpen className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{teamOverview.totalCourses}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('learning.totalCourses', 'Total Courses')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{teamOverview.totalEnrollments}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('learning.totalEnrollments', 'Total Enrollments')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{teamOverview.completionRate}%</p>
                  <p className="text-sm text-muted-foreground">
                    {t('learning.completionRate', 'Completion Rate')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Award className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{teamOverview.mandatoryCourses}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('learning.mandatoryCourses', 'Mandatory Courses')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="catalog" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            {t('learning.courseCatalog', 'Course Catalog')}
          </TabsTrigger>
          <TabsTrigger value="my-courses" className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4" />
            {t('learning.myCourses', 'My Courses')}
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="team" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              {t('learning.teamOverview', 'Team Overview')}
            </TabsTrigger>
          )}
        </TabsList>

        {/* Course Catalog Tab */}
        <TabsContent value="catalog" className="space-y-6">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-4">
                <div className="relative flex-1 min-w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t('learning.searchCourses', 'Search courses...')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder={t('learning.allCategories', 'All Categories')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        {t('learning.allCategories', 'All Categories')}
                      </SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder={t('learning.allDifficulties', 'All Levels')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        {t('learning.allDifficulties', 'All Levels')}
                      </SelectItem>
                      <SelectItem value="beginner">{t('learning.beginner', 'Beginner')}</SelectItem>
                      <SelectItem value="intermediate">
                        {t('learning.intermediate', 'Intermediate')}
                      </SelectItem>
                      <SelectItem value="advanced">{t('learning.advanced', 'Advanced')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Course Grid */}
          {filteredCourses.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <BookOpen className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">
                  {t('learning.noCourses', 'No courses available')}
                </h3>
                <p className="text-muted-foreground">
                  {t('learning.noCoursesDesc', 'Check back later or contact your admin')}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCourses.map((course) => (
                <Card
                  key={course._id}
                  className="hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => {
                    setSelectedCourse(course);
                    setShowCourseDetail(true);
                  }}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg line-clamp-2">{course.title}</CardTitle>
                      {course.isMandatory && (
                        <Badge variant="destructive" className="text-xs">
                          {t('learning.mandatory', 'Mandatory')}
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="line-clamp-2">
                      {course.description ||
                        t('learning.noDescription', 'No description available')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <BookOpen className="h-4 w-4" />
                        {course.lessonCount} {t('learning.lessons', 'lessons')}
                      </span>
                      {course.estimatedHours && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {course.estimatedHours}h
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {course.creatorName}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge className={getDifficultyColor(course.difficulty)}>
                        {t(`learning.${course.difficulty}`, course.difficulty)}
                      </Badge>
                      <Badge variant="outline">{course.category}</Badge>
                    </div>

                    {isEnrolled(course._id) && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            {t('learning.progress', 'Progress')}
                          </span>
                          <span className="font-medium">{getEnrollmentProgress(course._id)}%</span>
                        </div>
                        <Progress value={getEnrollmentProgress(course._id)} className="h-2" />
                      </div>
                    )}

                    <div className="flex gap-2">
                      {!isEnrolled(course._id) ? (
                        <Button
                          className="w-full"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEnroll(course._id);
                          }}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          {t('learning.enroll', 'Enroll')}
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCourse(course);
                            setShowCourseDetail(true);
                          }}
                        >
                          {getEnrollmentProgress(course._id) === 0
                            ? t('learning.startCourse', 'Start Course')
                            : getEnrollmentProgress(course._id) === 100
                              ? t('learning.completed', 'Completed')
                              : t('learning.continueCourse', 'Continue')}
                          <ChevronRight className="h-4 w-4 ml-2" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* My Courses Tab */}
        <TabsContent value="my-courses" className="space-y-6">
          {!myEnrollments || myEnrollments.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <GraduationCap className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">
                  {t('learning.noEnrollments', 'No enrolled courses')}
                </h3>
                <p className="text-muted-foreground">
                  {t('learning.noEnrollmentsDesc', 'Browse the course catalog to get started')}
                </p>
                <Button className="mt-4" onClick={() => setActiveTab('catalog')}>
                  <BookOpen className="h-4 w-4 mr-2" />
                  {t('learning.browseCatalog', 'Browse Catalog')}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {myEnrollments.map((enrollment) => (
                <Card key={enrollment._id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold">{enrollment.courseTitle}</h3>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Badge className={getStatusColor(enrollment.status)}>
                              {t(`learning.${enrollment.status}`, enrollment.status)}
                            </Badge>
                          </span>
                          {enrollment.startedAt && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {new Date(enrollment.startedAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-2xl font-bold">{enrollment.progress ?? 0}%</p>
                          <p className="text-sm text-muted-foreground">
                            {t('learning.progress', 'Progress')}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setSelectedCourse(enrollment.course as CourseWithLessons);
                            setShowCourseDetail(true);
                          }}
                        >
                          <Play className="h-4 w-4 mr-2" />
                          {enrollment.progress === 0
                            ? t('learning.startCourse', 'Start Course')
                            : enrollment.progress === 100
                              ? t('learning.review', 'Review')
                              : t('learning.continueCourse', 'Continue')}
                        </Button>
                      </div>
                    </div>
                    <Progress value={enrollment.progress ?? 0} className="mt-4 h-2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Team Overview Tab (Admin Only) */}
        {isAdmin && (
          <TabsContent value="team" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  {t('learning.teamProgress', 'Team Progress')}
                </CardTitle>
                <CardDescription>
                  {t('learning.teamProgressDesc', 'Overview of team learning activity')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-3xl font-bold">{teamOverview?.totalCourses ?? 0}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t('learning.totalCourses', 'Total Courses')}
                    </p>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-3xl font-bold">{teamOverview?.totalEnrollments ?? 0}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t('learning.totalEnrollments', 'Total Enrollments')}
                    </p>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-3xl font-bold">{teamOverview?.completionRate ?? 0}%</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t('learning.completionRate', 'Completion Rate')}
                    </p>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-3xl font-bold">{teamOverview?.mandatoryCourses ?? 0}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t('learning.mandatoryCourses', 'Mandatory Courses')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Course Detail Dialog */}
      <Dialog open={showCourseDetail} onOpenChange={setShowCourseDetail}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedCourse?.title}</DialogTitle>
          </DialogHeader>
          {selectedCourse && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge className={getDifficultyColor(selectedCourse.difficulty)}>
                  {t(`learning.${selectedCourse.difficulty}`, selectedCourse.difficulty)}
                </Badge>
                <Badge variant="outline">{selectedCourse.category}</Badge>
                {selectedCourse.isMandatory && (
                  <Badge variant="destructive">{t('learning.mandatory', 'Mandatory')}</Badge>
                )}
              </div>

              <p className="text-muted-foreground">
                {selectedCourse.description ||
                  t('learning.noDescription', 'No description available')}
              </p>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium">{t('learning.instructor', 'Instructor')}</p>
                  <p className="text-muted-foreground">{selectedCourse.creatorName}</p>
                </div>
                <div>
                  <p className="font-medium">{t('learning.lessons', 'Lessons')}</p>
                  <p className="text-muted-foreground">{selectedCourse.lessonCount}</p>
                </div>
                {selectedCourse.estimatedHours && (
                  <div>
                    <p className="font-medium">{t('learning.estimatedHours', 'Estimated Hours')}</p>
                    <p className="text-muted-foreground">{selectedCourse.estimatedHours}h</p>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCourseDetail(false)}>
                  {t('common.close', 'Close')}
                </Button>
                {!isEnrolled(selectedCourse._id) && (
                  <Button onClick={() => handleEnroll(selectedCourse._id)}>
                    <Plus className="h-4 w-4 mr-2" />
                    {t('learning.enroll', 'Enroll')}
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Course Dialog */}
      <Dialog
        open={showCreateCourse}
        onOpenChange={(open) => {
          setShowCreateCourse(open);
          if (!open) {
            setCourseForm({
              title: '',
              description: '',
              category: '',
              difficulty: 'beginner',
              estimatedHours: '',
              isMandatory: false,
              tags: '',
            });
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('learning.createCourse', 'Create Course')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">{t('orgChart.nodeName', 'Name')} *</label>
              <Input
                value={courseForm.title}
                onChange={(e) => setCourseForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder={t('learning.courseTitle', 'Course title')}
              />
            </div>
            <div>
              <label className="text-sm font-medium">
                {t('learning.courseDescription', 'Description')}
              </label>
              <Input
                value={courseForm.description}
                onChange={(e) =>
                  setCourseForm((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder={t('placeholders.enterDescription', 'Enter course description')}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">
                  {t('learning.category', 'Category')} *
                </label>
                <Input
                  value={courseForm.category}
                  onChange={(e) => setCourseForm((prev) => ({ ...prev, category: e.target.value }))}
                  placeholder={t('placeholders.enterCategory', 'e.g. Compliance, Technical')}
                />
              </div>
              <div>
                <label className="text-sm font-medium">
                  {t('learning.difficulty', 'Difficulty')}
                </label>
                <Select
                  value={courseForm.difficulty}
                  onValueChange={(value) =>
                    setCourseForm((prev) => ({
                      ...prev,
                      difficulty: value as 'beginner' | 'intermediate' | 'advanced',
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">{t('learning.beginner', 'Beginner')}</SelectItem>
                    <SelectItem value="intermediate">
                      {t('learning.intermediate', 'Intermediate')}
                    </SelectItem>
                    <SelectItem value="advanced">{t('learning.advanced', 'Advanced')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">
                  {t('learning.estimatedHours', 'Estimated Hours')}
                </label>
                <Input
                  type="number"
                  min="0"
                  value={courseForm.estimatedHours}
                  onChange={(e) =>
                    setCourseForm((prev) => ({ ...prev, estimatedHours: e.target.value }))
                  }
                  placeholder="e.g. 4"
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t('learning.tags', 'Tags')}</label>
                <Input
                  value={courseForm.tags}
                  onChange={(e) => setCourseForm((prev) => ({ ...prev, tags: e.target.value }))}
                  placeholder={t('placeholders.commaSeparated', 'Comma separated')}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isMandatory"
                checked={courseForm.isMandatory}
                onChange={(e) =>
                  setCourseForm((prev) => ({ ...prev, isMandatory: e.target.checked }))
                }
                className="h-4 w-4 rounded border-gray-300"
              />
              <label htmlFor="isMandatory" className="text-sm font-medium">
                {t('learning.mandatory', 'Mandatory')}
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateCourse(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button onClick={handleCreateCourse}>
              <Plus className="h-4 w-4 mr-2" />
              {t('learning.createCourse', 'Create Course')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
