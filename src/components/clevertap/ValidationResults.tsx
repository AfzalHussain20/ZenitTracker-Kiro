'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ValidationResult, calculateValidationScore, generateValidationReport, exportValidationToExcel } from '@/lib/smartSheetAnalyzer';
import { CheckCircle2, XCircle, AlertCircle, Download, FileText } from 'lucide-react';
import { motion } from 'framer-motion';
import * as XLSX from 'xlsx';

interface ValidationResultsProps {
  results: ValidationResult[];
  title: string;
  eventName: string;
}

export function ValidationResults({ results, title, eventName }: ValidationResultsProps) {
  const score = calculateValidationScore(results);
  const passCount = results.filter(r => r.status === 'pass').length;
  const failCount = results.filter(r => r.status === 'fail').length;

  const handleExportExcel = () => {
    const workbook = exportValidationToExcel(results, title, eventName);
    XLSX.writeFile(workbook, `Validation_${title}_${eventName}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleViewReport = () => {
    const report = generateValidationReport(title, eventName, results);
    const blob = new Blob([report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Validation_Report_${title}_${eventName}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getScoreColor = () => {
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 50) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const getScoreGradient = () => {
    if (score >= 80) return 'from-emerald-500 to-green-600';
    if (score >= 50) return 'from-amber-500 to-orange-600';
    return 'from-red-500 to-rose-600';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Score Card */}
      <Card className="relative overflow-hidden">
        <div className={`absolute inset-0 bg-gradient-to-br ${getScoreGradient()} opacity-10`} />
        <CardHeader className="relative">
          <CardTitle className="flex items-center justify-between">
            <div>
              <span className="text-lg">Validation Results</span>
              <p className="text-sm font-normal text-muted-foreground mt-1">
                {title} - {eventName}
              </p>
            </div>
            <Badge className={`${getScoreColor()} text-white text-lg px-4 py-2`}>
              {score}%
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="relative">
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <div className="text-3xl font-bold">{results.length}</div>
              <div className="text-xs text-muted-foreground mt-1">Total Attributes</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950">
              <div className="text-3xl font-bold text-emerald-600">{passCount}</div>
              <div className="text-xs text-muted-foreground mt-1">Passed</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-red-50 dark:bg-red-950">
              <div className="text-3xl font-bold text-red-600">{failCount}</div>
              <div className="text-xs text-muted-foreground mt-1">Failed</div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleExportExcel} variant="outline" className="flex-1">
              <Download className="w-4 h-4 mr-2" />
              Export Excel
            </Button>
            <Button onClick={handleViewReport} variant="outline" className="flex-1">
              <FileText className="w-4 h-4 mr-2" />
              View Report
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Failed Validations */}
      {failCount > 0 && (
        <Card className="border-red-200 dark:border-red-900">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2 text-red-600">
              <XCircle className="w-4 h-4" />
              Failed Validations ({failCount})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {results.filter(r => r.status === 'fail').map((result, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="p-4 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-semibold text-sm text-red-900 dark:text-red-100">
                      {result.attribute}
                    </div>
                    <div className="text-xs text-red-700 dark:text-red-300 mt-1">
                      {result.message}
                    </div>
                    <div className="flex gap-4 mt-2 text-xs">
                      <span className="text-muted-foreground">
                        Expected: <strong className="text-foreground">{result.expected}</strong>
                      </span>
                      <span className="text-muted-foreground">
                        Actual: <strong className="text-foreground">{result.actual}</strong>
                      </span>
                    </div>
                  </div>
                  <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                </div>
              </motion.div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Passed Validations */}
      <Card className="border-emerald-200 dark:border-emerald-900">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2 text-emerald-600">
            <CheckCircle2 className="w-4 h-4" />
            Passed Validations ({passCount})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-60 overflow-y-auto space-y-2">
            {results.filter(r => r.status === 'pass').map((result, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.02 }}
                className="flex items-center gap-2 text-sm p-2 rounded hover:bg-emerald-50 dark:hover:bg-emerald-950"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span className="flex-1">{result.attribute}</span>
                <span className="text-xs text-muted-foreground">{result.message}</span>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Validation Tips */}
      {failCount > 0 && (
        <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-900">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-sm text-blue-900 dark:text-blue-100">
                  Validation Tips
                </h4>
                <ul className="text-xs text-blue-700 dark:text-blue-300 mt-2 space-y-1 list-disc list-inside">
                  <li>Attributes marked &quot;Yes&quot; must have actual values (not NA/null/blank)</li>
                  <li>Attributes marked &quot;No&quot; should only contain &quot;NA&quot;</li>
                  <li>Extra attributes not in the data dictionary are flagged as failures</li>
                  <li>Review the data dictionary to ensure correct expected values</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
