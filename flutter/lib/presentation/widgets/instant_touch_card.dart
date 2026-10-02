import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Instant Touch Response Card (Zero-Latency Micro-Haptics).
///
/// Triggers haptic pulse on pointer contact (0ms) rather than waiting
/// for standard GestureDetector tap-up recognition (typically 100-300ms delay).
class InstantTouchCard extends StatefulWidget {
  final Widget child;
  final VoidCallback onTap;
  final BorderRadius? borderRadius;

  const InstantTouchCard({
    super.key,
    required this.child,
    required this.onTap,
    this.borderRadius,
  });

  @override
  State<InstantTouchCard> createState() => _InstantTouchCardState();
}

class _InstantTouchCardState extends State<InstantTouchCard>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 70),
      reverseDuration: const Duration(milliseconds: 140),
    );
    _scaleAnimation = Tween<double>(begin: 1.0, end: 0.97).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return RepaintBoundary(
      child: Listener(
        onPointerDown: (_) {
          HapticFeedback.lightImpact();
          _controller.forward();
        },
        onPointerUp: (_) => _controller.reverse(),
        onPointerCancel: (_) => _controller.reverse(),
        child: GestureDetector(
          onTap: widget.onTap,
          behavior: HitTestBehavior.opaque,
          child: ScaleTransition(
            scale: _scaleAnimation,
            child: widget.child,
          ),
        ),
      ),
    );
  }
}
