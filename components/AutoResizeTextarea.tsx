import React, { useRef, useLayoutEffect } from 'react';

type AutoResizeTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const AutoResizeTextarea: React.FC<AutoResizeTextareaProps> = (props) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Temporarily reset height to auto to get the correct scrollHeight
      textarea.style.height = 'auto';
      // Set the height to the scroll height to fit the content
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [props.value]); // Re-run this effect when the textarea value changes

  return <textarea ref={textareaRef} {...props} />;
};

export default AutoResizeTextarea;
