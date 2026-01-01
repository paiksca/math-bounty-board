import { Link } from 'react-router-dom';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LatexRenderer } from '@/components/LatexRenderer';
import { Clock, Coins, User, Users } from 'lucide-react';
import { formatDistanceToNow, isPast } from 'date-fns';

interface Problem {
  id: string;
  title: string;
  description: string;
  bounty: number;
  deadline: string;
  status: string;
  tags: string[];
  difficulty: string | null;
  creator: {
    username: string;
  };
  solution_count: number;
}

interface ProblemCardProps {
  problem: Problem;
}

export function ProblemCard({ problem }: ProblemCardProps) {
  const isExpired = isPast(new Date(problem.deadline));
  const timeLeft = formatDistanceToNow(new Date(problem.deadline), { addSuffix: true });

  return (
    <Link to={`/problem/${problem.id}`}>
      <Card className="h-full transition-all hover:shadow-lg hover:border-primary/30 hover:-translate-y-1">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <h3 className="font-serif text-lg font-semibold leading-tight line-clamp-2">
              {problem.title}
            </h3>
            <Badge 
              variant={isExpired ? 'secondary' : 'default'}
              className={isExpired ? '' : 'bg-chart-1/20 text-chart-1 hover:bg-chart-1/30'}
            >
              <Coins className="mr-1 h-3 w-3" />
              {problem.bounty.toFixed(0)}
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="pb-3">
          <div className="text-sm text-muted-foreground line-clamp-3">
            <LatexRenderer content={problem.description.slice(0, 200)} />
          </div>
          
          {problem.tags && problem.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {problem.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {problem.tags.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{problem.tags.length - 3}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
        
        <CardFooter className="pt-3 border-t border-border">
          <div className="flex w-full items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {problem.creator.username}
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {problem.solution_count} solution{problem.solution_count !== 1 ? 's' : ''}
              </span>
            </div>
            <span 
              className={`flex items-center gap-1 ${isExpired ? 'text-destructive' : ''}`}
              title={new Date(problem.deadline).toLocaleString()}
            >
              <Clock className="h-3 w-3" />
              {timeLeft}
            </span>
          </div>
        </CardFooter>
      </Card>
    </Link>
  );
}
