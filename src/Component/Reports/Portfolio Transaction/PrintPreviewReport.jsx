// components/Reports/PrintPreviewReport.jsx
import React from 'react';

const PrintPreviewReport = ({ reportData, startDate, endDate }) => {
  // Helper to format date for display
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  return (
    <div className="p-8 font-sans bg-white" style={{ pageBreakAfter: 'always' }}>
      <h1 className="text-3xl font-bold mb-4 text-center text-gray-800">
        General Transaction Report
      </h1>
      <p className="text-center text-gray-600 mb-8">
        Report Period: {formatDate(startDate)} to {formatDate(endDate)}
      </p>

      {Object.keys(reportData).length === 0 ? (
        <p className="text-center text-gray-600">No data available for this report.</p>
      ) : (
        Object.keys(reportData).map((staff) => (
          <div key={staff} className="mb-8 border border-gray-300 rounded-lg overflow-hidden shadow-sm">
            <div className="bg-gray-100 p-4">
              <h2 className="font-bold text-xl text-gray-800">Staff: {staff}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-white">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Group ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Group Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Count</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Principal</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Outstanding</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Interest</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {Object.values(reportData[staff]).map((group) => (
                    <tr key={group.groupId}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{group.groupId}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{group.groupName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{group.count}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${group.principal.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${group.outstanding.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${group.interest.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default PrintPreviewReport;