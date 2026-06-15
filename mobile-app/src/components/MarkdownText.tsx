import React from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';

interface MarkdownTextProps {
  content: string;
}

export const MarkdownText: React.FC<MarkdownTextProps> = ({ content }) => {
  if (!content) return null;

  // 1. Split content by code blocks first
  const parts = content.split('```');
  const elements = parts.map((part, index) => {
    const isCodeBlock = index % 2 === 1;
    if (isCodeBlock) {
      // Find the language if specified
      const lines = part.split('\n');
      let language = '';
      let codeText = part;
      
      if (lines.length > 1 && /^[a-zA-Z0-9_-]+$/.test(lines[0].trim())) {
        language = lines[0].trim();
        codeText = lines.slice(1).join('\n');
      }
      
      // Trim empty lines
      codeText = codeText.replace(/^\n+|\n+$/g, '');

      return (
        <View key={index} style={mdStyles.codeBlockContainer}>
          {language ? <Text style={mdStyles.codeBlockLang}>{language}</Text> : null}
          <ScrollView horizontal style={{ width: '100%' }} showsHorizontalScrollIndicator={true}>
            <Text style={mdStyles.codeText}>{codeText}</Text>
          </ScrollView>
        </View>
      );
    } else {
      // Parse block elements (headers, list items, paragraphs)
      const blockLines = part.split('\n');
      const blockElements: React.ReactNode[] = [];

      for (let i = 0; i < blockLines.length; i++) {
        const line = blockLines[i];
        const trimmed = line.trim();

        // 0. Tables
        if (trimmed.startsWith('|') && i + 1 < blockLines.length && blockLines[i + 1].trim().startsWith('|')) {
          const nextTrimmed = blockLines[i + 1].trim();
          const isDivider = /^\|[\s\-\|:]+\|$/.test(nextTrimmed);
          if (isDivider) {
            const headerParts = line.split('|').map(x => x.trim());
            if (headerParts[0] === '') headerParts.shift();
            if (headerParts[headerParts.length - 1] === '') headerParts.pop();

            const numCols = headerParts.length;

            const dividerParts = nextTrimmed.split('|').map(x => x.trim());
            if (dividerParts[0] === '') dividerParts.shift();
            if (dividerParts[dividerParts.length - 1] === '') dividerParts.pop();

            const alignments = dividerParts.map(part => {
              const startCol = part.startsWith(':');
              const endCol = part.endsWith(':');
              if (startCol && endCol) return 'center';
              if (endCol) return 'right';
              return 'left';
            });

            const rows: string[][] = [];
            let j = i + 2;
            while (j < blockLines.length && blockLines[j].trim().startsWith('|')) {
              const rowLine = blockLines[j];
              const rowParts = rowLine.split('|').map(x => x.trim());
              if (rowParts[0] === '') rowParts.shift();
              if (rowParts[rowParts.length - 1] === '') rowParts.pop();
              
              while (rowParts.length < numCols) rowParts.push('');
              if (rowParts.length > numCols) rowParts.length = numCols;
              
              rows.push(rowParts);
              j++;
            }

            blockElements.push(
              <ScrollView 
                horizontal 
                key={`table-${i}`} 
                style={mdStyles.tableContainer}
                contentContainerStyle={{ minWidth: '100%' }}
                showsHorizontalScrollIndicator={true}
              >
                <View style={mdStyles.table}>
                  <View style={mdStyles.tableHeaderRow}>
                    {headerParts.map((hText, hIdx) => {
                      const align = alignments[hIdx] || 'left';
                      return (
                        <View 
                          key={`th-${hIdx}`} 
                          style={[
                            mdStyles.tableHeaderCell, 
                            { 
                              alignItems: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start'
                            }
                          ]}
                        >
                          <Text style={mdStyles.tableHeaderCellText}>
                            {parseInlineStyles(hText)}
                          </Text>
                        </View>
                      );
                    })}
                  </View>

                  {rows.map((rowCells, rIdx) => (
                    <View 
                      key={`tr-${rIdx}`} 
                      style={[
                        mdStyles.tableRow,
                        rIdx % 2 === 1 && mdStyles.tableRowAlt,
                        rIdx === rows.length - 1 && mdStyles.tableRowLast
                      ]}
                    >
                      {rowCells.map((cellText, cIdx) => {
                        const align = alignments[cIdx] || 'left';
                        return (
                          <View 
                            key={`td-${cIdx}`} 
                            style={[
                              mdStyles.tableCell,
                              { 
                                alignItems: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start'
                              }
                            ]}
                          >
                            <Text style={mdStyles.tableCellText}>
                              {parseInlineStyles(cellText)}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  ))}
                </View>
              </ScrollView>
            );

            i = j - 1;
            continue;
          }
        }

        // 1. Headers
        if (trimmed.startsWith('#')) {
          const depth = trimmed.match(/^#+/)?.[0].length || 1;
          const headerText = trimmed.replace(/^#+\s*/, '');
          const style = depth === 1 ? mdStyles.h1 : depth === 2 ? mdStyles.h2 : mdStyles.h3;
          blockElements.push(
            <Text key={`h-${i}`} style={style}>
              {parseInlineStyles(headerText)}
            </Text>
          );
          continue;
        }

        // 2. Unordered lists
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const itemText = trimmed.substring(2);
          blockElements.push(
            <View key={`li-${i}`} style={mdStyles.listItem}>
              <Text style={mdStyles.bullet}>• </Text>
              <Text style={mdStyles.listItemText}>{parseInlineStyles(itemText)}</Text>
            </View>
          );
          continue;
        }

        // 3. Numbered lists
        if (/^\d+\.\s+/.test(trimmed)) {
          const match = trimmed.match(/^(\d+)\.\s+/);
          const num = match?.[1] || '';
          const itemText = trimmed.replace(/^\d+\.\s+/, '');
          blockElements.push(
            <View key={`ol-${i}`} style={mdStyles.listItem}>
              <Text style={mdStyles.bullet}>{num}. </Text>
              <Text style={mdStyles.listItemText}>{parseInlineStyles(itemText)}</Text>
            </View>
          );
          continue;
        }

        // 4. Horizontal Rule
        if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
          blockElements.push(<View key={`hr-${i}`} style={mdStyles.hr} />);
          continue;
        }

        // 5. Paragraphs
        if (trimmed) {
          blockElements.push(
            <Text key={`p-${i}`} style={mdStyles.paragraph}>
              {parseInlineStyles(line)}
            </Text>
          );
        } else {
          // Spacer for double newlines
          blockElements.push(<View key={`space-${i}`} style={{ height: 4 }} />);
        }
      }

      return <View key={index}>{blockElements}</View>;
    }
  });

  return <View style={mdStyles.container}>{elements}</View>;
};

// Simple inline parser for **bold**, *italic*, `inline code`, and [links](url)
function parseInlineStyles(text: string): React.ReactNode[] {
  const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`|\[.*?\]\(.*?\))/g;
  const parts = text.split(regex);
  
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <Text key={index} style={mdStyles.bold}>
          {part.slice(2, -2)}
        </Text>
      );
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return (
        <Text key={index} style={mdStyles.italic}>
          {part.slice(1, -1)}
        </Text>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <Text key={index} style={mdStyles.inlineCode}>
          {part.slice(1, -1)}
        </Text>
      );
    }
    if (part.startsWith('[') && part.includes('](')) {
      const match = part.match(/\[(.*?)\]\((.*?)\)/);
      if (match) {
        const linkText = match[1];
        return (
          <Text key={index} style={mdStyles.link}>
            {linkText}
          </Text>
        );
      }
    }
    return part;
  });
}

const mdStyles = StyleSheet.create({
  container: {
    width: '100%',
  },
  paragraph: {
    color: '#f0f6fc',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  h1: {
    color: '#58a6ff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 8,
  },
  h2: {
    color: '#58a6ff',
    fontSize: 17,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 6,
  },
  h3: {
    color: '#f0f6fc',
    fontSize: 15,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 4,
  },
  bold: {
    fontWeight: 'bold',
    color: '#ffffff',
  },
  italic: {
    fontStyle: 'italic',
  },
  inlineCode: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    backgroundColor: '#21262d',
    color: '#ff7b72',
    fontSize: 12.5,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  codeBlockContainer: {
    backgroundColor: '#0d1117',
    borderWidth: 1,
    borderColor: '#30363d',
    borderRadius: 6,
    padding: 10,
    marginVertical: 10,
    width: '100%',
  },
  codeBlockLang: {
    color: '#8b949e',
    fontSize: 11,
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#21262d',
    paddingBottom: 4,
  },
  codeText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#c9d1d9',
    fontSize: 13,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginLeft: 8,
    marginVertical: 3,
  },
  bullet: {
    color: '#58a6ff',
    fontSize: 14,
    marginRight: 6,
  },
  listItemText: {
    color: '#f0f6fc',
    fontSize: 14,
    lineHeight: 18,
    flex: 1,
  },
  hr: {
    height: 1,
    backgroundColor: '#30363d',
    marginVertical: 12,
  },
  link: {
    color: '#58a6ff',
    textDecorationLine: 'underline',
  },
  tableContainer: {
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#30363d',
    borderRadius: 6,
    width: '100%',
  },
  table: {
    minWidth: 500,
    backgroundColor: '#0d1117',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#161b22',
    borderBottomWidth: 1,
    borderBottomColor: '#30363d',
  },
  tableHeaderCell: {
    flex: 1,
    padding: 8,
    justifyContent: 'center',
  },
  tableHeaderCellText: {
    color: '#c9d1d9',
    fontSize: 13,
    fontWeight: '600',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#21262d',
  },
  tableRowAlt: {
    backgroundColor: '#161b22',
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  tableCell: {
    flex: 1,
    padding: 8,
    justifyContent: 'center',
  },
  tableCellText: {
    color: '#f0f6fc',
    fontSize: 13,
    lineHeight: 18,
  },
});
