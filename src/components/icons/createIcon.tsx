import { PureComponent, type ComponentClass, type ReactNode, type SVGProps } from "react";

export interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

export type IconComponent = ComponentClass<IconProps>;

interface IconDefaults {
  viewBox?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}

function defaultSize(viewBox: string) {
  const parts = viewBox.split(/\s+/).map(Number);
  if (parts.length === 4 && Number.isFinite(parts[2]) && Number.isFinite(parts[3]) && parts[2] === parts[3]) {
    return parts[2];
  }
  return 28;
}

export function createIcon(displayName: string, children: ReactNode, defaults: IconDefaults = {}): IconComponent {
  const viewBox = defaults.viewBox ?? "0 0 28 28";
  const fallbackSize = defaultSize(viewBox);

  class Icon extends PureComponent<IconProps> {
    static displayName = displayName;

    render() {
      const { size, ...rest } = this.props;
      return (
        <svg
          width={size ?? fallbackSize}
          height={size ?? fallbackSize}
          viewBox={viewBox}
          fill={defaults.fill ?? "none"}
          stroke={defaults.stroke ?? "currentColor"}
          strokeWidth={defaults.strokeWidth ?? 1.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
          {...rest}
        >
          {children}
        </svg>
      );
    }
  }

  return Icon;
}
